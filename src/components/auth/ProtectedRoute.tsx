import { Navigate, Outlet } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyDataProvider } from '@/hooks/useCompanyData'
import { useAuth } from '@/hooks/useAuth'

function FullScreenLoader({ label = 'Cargando MiniPost…' }: { label?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
      <LoadingSpinner className="h-8 w-8" />
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  )
}

function MissingProfile() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle>Tu cuenta no tiene negocio asociado</CardTitle>
          <CardDescription>El registro no creó la empresa ni los datos demo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-[var(--color-muted-foreground)]">
            <li>Ejecuta <code className="rounded bg-[var(--color-muted)] px-1">supabase/schema.sql</code> en el SQL Editor.</li>
            <li>Desactiva <strong>Confirm email</strong> en Authentication.</li>
            <li>Cierra sesión y regístrate de nuevo.</li>
          </ul>
          <Button variant="outline" onClick={() => void signOut()}>Cerrar sesión</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function ProtectedRoute() {
  const { session, profile, loading, profileStatus } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (profileStatus !== 'ready') return <FullScreenLoader label="Cargando tu negocio…" />
  if (!profile) return <MissingProfile />

  return (
    <CompanyDataProvider>
      <Outlet />
    </CompanyDataProvider>
  )
}

export function PublicRoute() {
  const { session, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}
