import { Database, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabaseConfigHint } from '@/lib/supabase'

export function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Database className="h-6 w-6" />
          </div>
          <CardTitle>Conecta tu proyecto de Supabase Cloud</CardTitle>
          <CardDescription>{supabaseConfigHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Crea un proyecto en{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline">
                supabase.com/dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              En <strong>SQL Editor</strong>, ejecuta el contenido de{' '}
              <code className="rounded bg-[var(--color-muted)] px-1">supabase/schema.sql</code>
            </li>
            <li>
              Desactiva <strong>Confirm email</strong> en Authentication → Sign In / Providers → Email
            </li>
            <li>
              Copia <strong>Project URL</strong> y la clave <strong>anon / publishable</strong> (empieza con{' '}
              <code className="rounded bg-[var(--color-muted)] px-1">sb_publishable_</code> o{' '}
              <code className="rounded bg-[var(--color-muted)] px-1">eyJ</code>). Nunca uses{' '}
              <code className="rounded bg-[var(--color-muted)] px-1">sb_secret_</code> ni service_role.
            </li>
            <li>
              La key de Gemini va en <code className="rounded bg-[var(--color-muted)] px-1">VITE_GEMINI_API_KEY</code>{' '}
              (desde aistudio.google.com, suele empezar con <code className="rounded bg-[var(--color-muted)] px-1">AIza</code>).
            </li>
          </ol>

          <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
{`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_GEMINI_API_KEY=AIza...`}
          </pre>

          <p className="text-[var(--color-muted-foreground)]">
            Guarda el archivo y reinicia <code className="rounded bg-[var(--color-muted)] px-1">npm run dev</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
