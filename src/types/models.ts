import type { Json } from '@/types/database'

export interface Profile {
  id: string
  company_id: string
  full_name: string
  role: string
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  price: number
  active: boolean
  quantity: number
  minStock: number
  inventoryId: string
  createdAt: Date
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  lastPurchaseAt: Date | null
  createdAt: Date
}

export interface SaleItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface Sale {
  id: string
  customerId: string | null
  customerName: string | null
  total: number
  items: SaleItem[]
  createdAt: Date
}

export interface Alert {
  id: string
  type: string
  title: string
  message: string
  status: 'pending' | 'resolved'
  createdAt: Date
}

export type RecommendationAction = 'buy_stock' | 'create_promotion' | 'contact_customer'

export interface RecommendationMetadata {
  productId?: string
  productName?: string
  quantity?: number
  discountPct?: number
  customerId?: string
  customerName?: string
}

export interface Recommendation {
  id: string
  type: string
  title: string
  message: string
  actionType: RecommendationAction
  status: 'pending' | 'accepted'
  metadata: RecommendationMetadata
  createdAt: Date
}

export interface Promotion {
  id: string
  productId: string | null
  productName: string | null
  discountPct: number
  description: string
  status: string
  createdAt: Date
}

export function isLowStock(product: Pick<Product, 'quantity' | 'minStock'>) {
  return product.quantity <= product.minStock
}

export function daysSince(date: Date | null) {
  if (!date) return Infinity
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function isInactiveCustomer(customer: Customer) {
  return daysSince(customer.lastPurchaseAt) > 30
}

function pickInventory(raw: unknown) {
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw as { id: string; quantity: number; min_stock: number } | null
}

export function mapProduct(row: {
  id: string
  name: string
  sku: string | null
  price: number
  active: boolean
  created_at: string
  inventory?: unknown
}): Product {
  const inv = pickInventory(row.inventory)
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    price: Number(row.price),
    active: row.active,
    quantity: inv?.quantity ?? 0,
    minStock: inv?.min_stock ?? 0,
    inventoryId: inv?.id ?? '',
    createdAt: new Date(row.created_at),
  }
}

export function mapCustomer(row: {
  id: string
  name: string
  email: string | null
  phone: string | null
  last_purchase_at: string | null
  created_at: string
}): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    lastPurchaseAt: row.last_purchase_at ? new Date(row.last_purchase_at) : null,
    createdAt: new Date(row.created_at),
  }
}

export function mapSale(row: {
  id: string
  customer_id: string | null
  total: number
  created_at: string
  customers?: { name: string } | null
  sale_items?: { product_id: string; quantity: number; unit_price: number; products?: { name: string } | null }[]
}): Sale {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customers?.name ?? null,
    total: Number(row.total),
    items: (row.sale_items ?? []).map((item) => ({
      productId: item.product_id,
      name: item.products?.name ?? 'Producto',
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
    createdAt: new Date(row.created_at),
  }
}

export function mapAlert(row: {
  id: string
  type: string
  title: string
  message: string
  status: string
  created_at: string
}): Alert {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    status: row.status === 'resolved' ? 'resolved' : 'pending',
    createdAt: new Date(row.created_at),
  }
}

export function mapRecommendation(row: {
  id: string
  type: string
  title: string
  message: string
  action_type: string
  status: string
  metadata: Json
  created_at: string
}): Recommendation {
  const metadata = (row.metadata ?? {}) as RecommendationMetadata
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    actionType: row.action_type as RecommendationAction,
    status: row.status === 'accepted' ? 'accepted' : 'pending',
    metadata: metadata,
    createdAt: new Date(row.created_at),
  }
}

export function mapPromotion(row: {
  id: string
  product_id: string | null
  discount_pct: number
  description: string
  status: string
  created_at: string
  products?: { name: string } | null
}): Promotion {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.products?.name ?? null,
    discountPct: Number(row.discount_pct),
    description: row.description,
    status: row.status,
    createdAt: new Date(row.created_at),
  }
}
