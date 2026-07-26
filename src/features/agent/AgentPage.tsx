import { useState } from 'react'
import { Bot, CheckCircle2, Sparkles, Wrench } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useCompanyData } from '@/hooks/useCompanyData'
import { executeRecommendation } from '@/features/agent/actions'
import { runBusinessAnalysis, type AgentRun } from '@/features/agent/agentService'
import { isGeminiConfigured } from '@/lib/gemini'
import { formatDateTime } from '@/lib/utils'
import type { Recommendation } from '@/types/models'

const ACTION_LABELS: Record<string, string> = {
  buy_stock: 'Reponer stock',
  create_promotion: 'Crear promoción',
  contact_customer: 'Contactar cliente',
}

export function AgentPage() {
  const { companyId } = useAuth()
  const { products, customers, sales, alerts, recommendations, promotions, loading } = useCompanyData()

  const [run, setRun] = useState<AgentRun | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [executingId, setExecutingId] = useState<string | null>(null)

  async function analyze() {
    if (!companyId) return

    setAnalyzing(true)
    setError(null)
    setRun(null)
    setActionMessage(null)
    setProgress('Iniciando análisis…')

    try {
      const result = await runBusinessAnalysis(
        { companyId, products, customers, sales },
        (message) => setProgress(message),
      )
      setRun(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'El análisis falló.')
    } finally {
      setAnalyzing(false)
      setProgress(null)
    }
  }

  async function accept(recommendation: Recommendation) {
    if (!companyId) return

    setExecutingId(recommendation.id)
    setActionMessage(null)

    try {
      const message = await executeRecommendation(companyId, recommendation)
      setActionMessage(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar la acción.')
    } finally {
      setExecutingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  const pending = recommendations.filter((rec) => rec.status === 'pending')
  const accepted = recommendations.filter((rec) => rec.status === 'accepted')

  return (
    <div className="space-y-6">
      <Card className="border-[var(--color-primary)]/30 bg-gradient-to-r from-indigo-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[var(--color-primary)]" />
            Agente Comercial Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            El agente inspecciona el negocio con sus herramientas, toma decisiones y ejecuta acciones reales
            sobre la base de datos.
          </p>

          {!isGeminiConfigured && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Falta <code>VITE_GEMINI_API_KEY</code> en el archivo <code>.env</code>. Consigue una gratis en{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Google AI Studio
              </a>{' '}
              y reinicia <code>npm run dev</code>.
            </p>
          )}

          <Button onClick={() => void analyze()} disabled={analyzing || !isGeminiConfigured}>
            <Sparkles className="h-4 w-4" />
            {analyzing ? 'Analizando…' : 'Analizar negocio'}
          </Button>

          {analyzing && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <LoadingSpinner className="h-4 w-4" />
              {progress ?? 'Consultando inventario, ventas y clientes…'}
            </div>
          )}

          {error && (
            <p className="whitespace-pre-line rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          {run && (
            <div className="space-y-3">
              <div className="rounded-md border border-[var(--color-border)] bg-white p-4">
                <p className="whitespace-pre-line text-sm">{run.summary}</p>
              </div>

              {run.steps.length > 0 && (
                <div className="rounded-md border border-[var(--color-border)] bg-white p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Wrench className="h-4 w-4" />
                    Herramientas ejecutadas
                  </p>
                  <ul className="space-y-1 text-sm text-[var(--color-muted-foreground)]">
                    {run.steps.map((step, index) => (
                      <li key={index}>· {step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {actionMessage && (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {actionMessage}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recomendaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 && accepted.length === 0 && (
              <EmptyState title="Sin recomendaciones" description="Ejecuta un análisis para generarlas" />
            )}

            {pending.map((rec) => (
              <div key={rec.id} className="rounded-md border border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{rec.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{rec.message}</p>
                    <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                      {formatDateTime(rec.createdAt)}
                    </p>
                  </div>
                  <Badge variant="warning">{ACTION_LABELS[rec.actionType] ?? rec.actionType}</Badge>
                </div>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={executingId === rec.id}
                  onClick={() => void accept(rec)}
                >
                  {executingId === rec.id ? 'Ejecutando...' : 'Aceptar y ejecutar'}
                </Button>
              </div>
            ))}

            {accepted.map((rec) => (
              <div key={rec.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{rec.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{rec.message}</p>
                  </div>
                  <Badge variant="success">Ejecutada</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{alert.message}</p>
                  </div>
                  <Badge variant={alert.status === 'resolved' ? 'success' : 'destructive'}>{alert.type}</Badge>
                </div>
              </div>
            )) : (
              <EmptyState title="Sin alertas" description="El agente las creará cuando detecte problemas" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promociones activas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {promotions.length > 0 ? promotions.map((promo) => (
            <div key={promo.id} className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] p-4">
              <div>
                <p className="font-medium">{promo.description}</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {promo.productName ?? 'Producto general'} · {promo.discountPct}% de descuento
                </p>
              </div>
              <Badge variant="success">{promo.status}</Badge>
            </div>
          )) : (
            <EmptyState
              title="Sin promociones"
              description="Acepta una recomendación de promoción y se creará automáticamente"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
