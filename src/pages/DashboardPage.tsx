import { Link } from 'react-router-dom'
import { AlertTriangle, Bot, DollarSign, Lightbulb, Package } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompanyData } from '@/hooks/useCompanyData'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { isLowStock } from '@/types/models'

export function DashboardPage() {
  const { products, sales, alerts, recommendations, loading, error } = useCompanyData()

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  if (error) {
    return <EmptyState title="No se pudieron cargar los datos" description={error} />
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const salesToday = sales.filter((sale) => sale.createdAt >= startOfToday)
  const revenueToday = salesToday.reduce((sum, sale) => sum + sale.total, 0)
  const pendingAlerts = alerts.filter((alert) => alert.status === 'pending')
  const pendingRecommendations = recommendations.filter((rec) => rec.status === 'pending')
  const lowStockProducts = products.filter(isLowStock)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas hoy"
          value={formatCurrency(revenueToday)}
          description={`${salesToday.length} ${salesToday.length === 1 ? 'venta' : 'ventas'}`}
          icon={DollarSign}
        />
        <StatCard
          title="Stock bajo"
          value={lowStockProducts.length}
          description={lowStockProducts.map((p) => p.name).slice(0, 2).join(', ') || 'Todo en orden'}
          icon={Package}
        />
        <StatCard title="Alertas pendientes" value={pendingAlerts.length} icon={AlertTriangle} />
        <StatCard title="Recomendaciones" value={pendingRecommendations.length} icon={Lightbulb} />
      </div>

      <Card className="border-[var(--color-primary)]/30 bg-gradient-to-r from-indigo-50 to-white">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Agente Comercial Inteligente</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Analiza el negocio, detecta problemas y ejecuta acciones por ti.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link to="/agent">Abrir agente</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alertas recientes</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/agent">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingAlerts.length > 0 ? pendingAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="rounded-md border border-[var(--color-border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{alert.title}</p>
                  <Badge variant="warning">{alert.type}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{alert.message}</p>
              </div>
            )) : (
              <EmptyState title="Sin alertas" description="El agente las creará al analizar tu negocio" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recomendaciones</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/agent">Ver agente</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRecommendations.length > 0 ? pendingRecommendations.slice(0, 5).map((rec) => (
              <div key={rec.id} className="rounded-md border border-[var(--color-border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{rec.title}</p>
                  <Badge variant="success">{rec.actionType}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{rec.message}</p>
              </div>
            )) : (
              <EmptyState title="Sin recomendaciones" description="Registra una venta o ejecuta el análisis" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length > 0 ? (
            <div className="space-y-2">
              {sales.slice(0, 6).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-md border border-[var(--color-border)] p-3">
                  <div>
                    <p className="font-medium">{formatCurrency(sale.total)}</p>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {sale.customerName ?? 'Cliente general'} · {sale.items.length}{' '}
                      {sale.items.length === 1 ? 'artículo' : 'artículos'}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--color-muted-foreground)]">{formatDateTime(sale.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin ventas" description="Usa el POS para registrar tu primera venta" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
