import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  fetchAlerts,
  fetchCustomers,
  fetchProducts,
  fetchPromotions,
  fetchRecommendations,
  fetchSales,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Alert, Customer, Product, Promotion, Recommendation, Sale } from '@/types/models'

interface CompanyDataValue {
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  alerts: Alert[]
  recommendations: Recommendation[]
  promotions: Promotion[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const CompanyDataContext = createContext<CompanyDataValue | undefined>(undefined)

export function CompanyDataProvider({ children }: { children: ReactNode }) {
  const { companyId } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!companyId) {
      setProducts([])
      setCustomers([])
      setSales([])
      setAlerts([])
      setRecommendations([])
      setPromotions([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [p, c, s, a, r, pr] = await Promise.all([
        fetchProducts(companyId),
        fetchCustomers(companyId),
        fetchSales(companyId),
        fetchAlerts(companyId),
        fetchRecommendations(companyId),
        fetchPromotions(companyId),
      ])
      setProducts(p)
      setCustomers(c)
      setSales(s)
      setAlerts(a)
      setRecommendations(r)
      setPromotions(pr)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!companyId) return

    const channel = supabase
      .channel(`company-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `company_id=eq.${companyId}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations', filter: `company_id=eq.${companyId}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions', filter: `company_id=eq.${companyId}` }, () => void refresh())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [companyId, refresh])

  const value = useMemo<CompanyDataValue>(() => ({
    products,
    customers,
    sales,
    alerts,
    recommendations,
    promotions,
    loading,
    error,
    refresh,
  }), [products, customers, sales, alerts, recommendations, promotions, loading, error, refresh])

  return <CompanyDataContext.Provider value={value}>{children}</CompanyDataContext.Provider>
}

export function useCompanyData() {
  const context = useContext(CompanyDataContext)
  if (!context) throw new Error('useCompanyData debe usarse dentro de CompanyDataProvider')
  return context
}
