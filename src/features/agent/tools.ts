import { Type, type FunctionDeclaration } from '@google/genai'
import { createAlert, createPromotion, createRecommendation } from '@/lib/db'
import { daysSince, isLowStock, type Customer, type Product, type Sale } from '@/types/models'

export interface AgentContext {
  companyId: string
  products: Product[]
  customers: Customer[]
  sales: Sale[]
}

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'getInventory',
    description: 'Devuelve todos los productos con su precio, stock actual y stock mínimo.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'getLowStock',
    description: 'Devuelve solo los productos cuyo stock está en o por debajo del mínimo.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'getSales',
    description:
      'Devuelve un resumen de ventas de los últimos 30 días: total facturado, número de ventas y unidades vendidas por producto.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'getCustomers',
    description: 'Devuelve los clientes con los días transcurridos desde su última compra.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'createAlert',
    description: 'Crea una alerta visible en el dashboard del negocio.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, description: 'Categoría: stock, rotacion, cliente o ventas.' },
        title: { type: Type.STRING, description: 'Título corto de la alerta.' },
        message: { type: Type.STRING, description: 'Explicación con las cifras concretas detectadas.' },
      },
      required: ['type', 'title', 'message'],
    },
  },
  {
    name: 'createRecommendation',
    description:
      'Crea una recomendación accionable que el dueño del negocio podrá aceptar con un clic para que se ejecute automáticamente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Acción sugerida en una frase.' },
        message: { type: Type.STRING, description: 'Justificación con los datos que la respaldan.' },
        actionType: {
          type: Type.STRING,
          enum: ['buy_stock', 'create_promotion', 'contact_customer'],
          description: 'Acción que se ejecutará al aceptar la recomendación.',
        },
        productId: { type: Type.STRING, description: 'Id del producto, obligatorio en buy_stock y create_promotion.' },
        quantity: { type: Type.NUMBER, description: 'Unidades a comprar, solo para buy_stock.' },
        discountPct: { type: Type.NUMBER, description: 'Descuento entre 10 y 30, solo para create_promotion.' },
        customerId: { type: Type.STRING, description: 'Id del cliente, solo para contact_customer.' },
      },
      required: ['title', 'message', 'actionType'],
    },
  },
  {
    name: 'createPromotion',
    description: 'Crea una promoción activa para un producto de forma inmediata.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING, description: 'Id del producto en promoción.' },
        discountPct: { type: Type.NUMBER, description: 'Porcentaje de descuento entre 5 y 50.' },
        description: { type: Type.STRING, description: 'Texto comercial de la promoción.' },
      },
      required: ['productId', 'discountPct', 'description'],
    },
  },
]

export interface ToolResult {
  tool: string
  label: string
  data: unknown
}

function unitsSoldByProduct(sales: Sale[], sinceDays: number) {
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000
  const units = new Map<string, number>()

  for (const sale of sales) {
    if (sale.createdAt.getTime() < cutoff) continue
    for (const item of sale.items) {
      units.set(item.productId, (units.get(item.productId) ?? 0) + item.quantity)
    }
  }

  return units
}

export function createToolExecutor(ctx: AgentContext) {
  const productById = new Map(ctx.products.map((p) => [p.id, p]))

  return async function execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    switch (name) {
      case 'getInventory': {
        const data = ctx.products.map((p) => ({
          productId: p.id,
          nombre: p.name,
          precio: p.price,
          stock: p.quantity,
          stockMinimo: p.minStock,
          stockBajo: isLowStock(p),
        }))
        return { tool: name, label: `Inventario consultado (${data.length} productos)`, data }
      }

      case 'getLowStock': {
        const data = ctx.products.filter(isLowStock).map((p) => ({
          productId: p.id,
          nombre: p.name,
          stock: p.quantity,
          stockMinimo: p.minStock,
          faltante: Math.max(p.minStock - p.quantity, 0),
        }))
        return { tool: name, label: `Stock bajo revisado (${data.length} productos)`, data }
      }

      case 'getSales': {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
        const recent = ctx.sales.filter((s) => s.createdAt.getTime() >= cutoff)
        const units = unitsSoldByProduct(ctx.sales, 30)

        const data = {
          ventasUltimos30Dias: recent.length,
          totalFacturado: recent.reduce((sum, s) => sum + s.total, 0),
          unidadesPorProducto: ctx.products.map((p) => ({
            productId: p.id,
            nombre: p.name,
            unidadesVendidas: units.get(p.id) ?? 0,
            stockActual: p.quantity,
          })),
        }
        return { tool: name, label: `Ventas analizadas (${recent.length} en 30 días)`, data }
      }

      case 'getCustomers': {
        const data = ctx.customers.map((c) => ({
          customerId: c.id,
          nombre: c.name,
          diasSinComprar: c.lastPurchaseAt ? daysSince(c.lastPurchaseAt) : null,
          inactivo: daysSince(c.lastPurchaseAt) > 30,
        }))
        return { tool: name, label: `Clientes revisados (${data.length})`, data }
      }

      case 'createAlert': {
        const id = await createAlert(ctx.companyId, {
          type: String(args.type ?? 'info'),
          title: String(args.title ?? 'Alerta'),
          message: String(args.message ?? ''),
        })
        return { tool: name, label: `Alerta creada: ${args.title}`, data: { id, ok: true } }
      }

      case 'createRecommendation': {
        const actionType = String(args.actionType ?? 'contact_customer')
        const productId = args.productId ? String(args.productId) : undefined
        const customerId = args.customerId ? String(args.customerId) : undefined

        const id = await createRecommendation(ctx.companyId, {
          type: actionType,
          title: String(args.title ?? 'Recomendación'),
          message: String(args.message ?? ''),
          actionType,
          metadata: {
            productId,
            productName: productId ? productById.get(productId)?.name : undefined,
            quantity: args.quantity ? Number(args.quantity) : undefined,
            discountPct: args.discountPct ? Number(args.discountPct) : undefined,
            customerId,
            customerName: customerId ? ctx.customers.find((c) => c.id === customerId)?.name : undefined,
          },
        })
        return { tool: name, label: `Recomendación creada: ${args.title}`, data: { id, ok: true } }
      }

      case 'createPromotion': {
        const productId = args.productId ? String(args.productId) : null
        const id = await createPromotion(ctx.companyId, {
          productId,
          discountPct: Number(args.discountPct ?? 10),
          description: String(args.description ?? 'Promoción'),
        })
        return { tool: name, label: `Promoción creada: ${args.description}`, data: { id, ok: true } }
      }

      default:
        return { tool: name, label: `Herramienta desconocida: ${name}`, data: { error: 'unknown tool' } }
    }
  }
}
