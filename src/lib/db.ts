import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import {
  mapAlert,
  mapCustomer,
  mapProduct,
  mapPromotion,
  mapRecommendation,
  mapSale,
  type Alert,
  type Customer,
  type Product,
  type Promotion,
  type Recommendation,
  type RecommendationMetadata,
  type Sale,
  type SaleItem,
} from '@/types/models'

// -----------------------------------------------------------------------------
// Lecturas
// -----------------------------------------------------------------------------

export async function fetchProducts(companyId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, inventory(*)')
    .eq('company_id', companyId)
    .order('name')

  if (error) throw error
  return (data ?? []).map(mapProduct)
}

export async function fetchCustomers(companyId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .order('name')

  if (error) throw error
  return (data ?? []).map(mapCustomer)
}

export async function fetchSales(companyId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, customers(name), sale_items(product_id, quantity, unit_price, products(name))')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []).map(mapSale)
}

export async function fetchAlerts(companyId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []).map(mapAlert)
}

export async function fetchRecommendations(companyId: string): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []).map(mapRecommendation)
}

export async function fetchPromotions(companyId: string): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*, products(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []).map(mapPromotion)
}

// -----------------------------------------------------------------------------
// Escrituras
// -----------------------------------------------------------------------------

export async function createProduct(
  companyId: string,
  input: { name: string; sku?: string; price: number; quantity: number; minStock: number },
) {
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      company_id: companyId,
      name: input.name,
      sku: input.sku?.trim() || null,
      price: input.price,
    })
    .select()
    .single()

  if (error) throw error

  const { error: invError } = await supabase.from('inventory').insert({
    product_id: product.id,
    quantity: input.quantity,
    min_stock: input.minStock,
  })

  if (invError) throw invError
}

export async function updateProductStock(inventoryId: string, quantity: number) {
  const { error } = await supabase
    .from('inventory')
    .update({ quantity: Math.max(0, Math.trunc(quantity)), updated_at: new Date().toISOString() })
    .eq('id', inventoryId)

  if (error) throw error
}

export async function addProductStock(productId: string, amount: number) {
  const { data: inv, error: fetchError } = await supabase
    .from('inventory')
    .select('id, quantity')
    .eq('product_id', productId)
    .single()

  if (fetchError || !inv) throw fetchError ?? new Error('Inventario no encontrado')

  const { error } = await supabase
    .from('inventory')
    .update({ quantity: inv.quantity + Math.trunc(amount), updated_at: new Date().toISOString() })
    .eq('id', inv.id)

  if (error) throw error
}

export async function createCustomer(
  companyId: string,
  input: { name: string; email?: string; phone?: string },
) {
  const { error } = await supabase.from('customers').insert({
    company_id: companyId,
    name: input.name,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  })

  if (error) throw error
}

/** El trigger de PostgreSQL descuenta inventario al insertar sale_items. */
export async function registerSale(
  companyId: string,
  input: { customerId: string | null; items: SaleItem[]; total: number },
) {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      company_id: companyId,
      customer_id: input.customerId,
      total: input.total,
    })
    .select()
    .single()

  if (saleError) throw saleError

  const { error: itemsError } = await supabase.from('sale_items').insert(
    input.items.map((item) => ({
      sale_id: sale.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
  )

  if (itemsError) throw itemsError
  return sale.id
}

export async function createAlert(
  companyId: string,
  input: { type: string; title: string; message: string; status?: 'pending' | 'resolved' },
) {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      company_id: companyId,
      type: input.type,
      title: input.title,
      message: input.message,
      status: input.status ?? 'pending',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function createRecommendation(
  companyId: string,
  input: {
    type: string
    title: string
    message: string
    actionType: string
    metadata?: RecommendationMetadata
  },
) {
  const { data, error } = await supabase
    .from('recommendations')
    .insert({
      company_id: companyId,
      type: input.type,
      title: input.title,
      message: input.message,
      action_type: input.actionType,
      metadata: (input.metadata ?? {}) as Json,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function createPromotion(
  companyId: string,
  input: { productId: string | null; discountPct: number; description: string },
) {
  const { data, error } = await supabase
    .from('promotions')
    .insert({
      company_id: companyId,
      product_id: input.productId,
      discount_pct: input.discountPct,
      description: input.description,
      status: 'active',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function markRecommendationAccepted(recommendationId: string) {
  const { error } = await supabase
    .from('recommendations')
    .update({ status: 'accepted' })
    .eq('id', recommendationId)

  if (error) throw error
}
