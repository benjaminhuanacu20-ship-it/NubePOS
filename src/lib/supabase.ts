import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

const PLACEHOLDER =
  /tu[-_]?proyecto|tu[-_]?anon|tu[-_]?gemini|your[-_]|example\.com|placeholder|^tu[_-]|TU[-_]PROYECTO|^<$|^>$/i

function isPlaceholder(value: string) {
  if (!value) return true
  return PLACEHOLDER.test(value)
}

/** Claves secretas / service_role: no se pueden usar en el navegador. */
export function isSecretSupabaseKey(value: string) {
  const key = value.trim()
  if (!key) return false
  if (/^sb_secret_/i.test(key)) return true
  if (/service_role/i.test(key)) return true
  // JWT legacy: payload con role service_role
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1] ?? '')) as { role?: string }
      return payload.role === 'service_role'
    } catch {
      return false
    }
  }
  return false
}

function looksLikeAnonKey(value: string) {
  if (isSecretSupabaseKey(value)) return false
  if (/^sb_publishable_/i.test(value)) return true
  if (value.startsWith('eyJ') && value.length > 80) return true
  return false
}

export const isSupabaseConfigured =
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(supabaseAnonKey) &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('.supabase.co') &&
  looksLikeAnonKey(supabaseAnonKey)

export const supabaseConfigHint = !supabaseUrl || !supabaseAnonKey
  ? 'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env.'
  : isSecretSupabaseKey(supabaseAnonKey)
    ? 'Estás usando la clave secreta (sb_secret_ / service_role). En el navegador solo vale la anon / publishable (sb_publishable_ o eyJ…).'
    : !supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')
      ? 'VITE_SUPABASE_URL debe ser la URL https de tu proyecto (…supabase.co).'
      : !looksLikeAnonKey(supabaseAnonKey)
        ? 'VITE_SUPABASE_ANON_KEY debe ser la clave anon/public o sb_publishable_…, no la secret.'
        : 'Las variables del .env todavía tienen valores de ejemplo. Pega la URL y la anon key reales.'

export const supabase = createClient<Database>(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
