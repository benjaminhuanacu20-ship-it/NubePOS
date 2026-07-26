import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

type ProfileStatus = 'idle' | 'loading' | 'ready'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  companyId: string | null
  loading: boolean
  profileStatus: ProfileStatus
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const CONFIRM_EMAIL_HINT =
  'Desactiva "Confirm email" en Supabase Dashboard > Authentication > Sign In / Providers > Email.'

const AUTH_TIMEOUT_MS = 8000

function translateAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Error inesperado.'
  if (message.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (message.includes('User already registered')) return 'Ese correo ya está registrado. Inicia sesión.'
  if (message.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (message.includes('Unable to validate email address')) return 'El correo no tiene un formato válido.'
  if (/Email signups are disabled/i.test(message) || /Signups not allowed/i.test(message)) {
    return 'Los registros por email están desactivados en Supabase. Activa Email y "Enable sign ups" en Authentication → Sign In / Providers → Email.'
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'No se pudo conectar a Supabase. Revisa VITE_SUPABASE_URL y tu conexión.'
  }
  return message
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout al conectar con Supabase')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle')

  useEffect(() => {
    let active = true

    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS)
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
      })
      .catch((err) => {
        console.error('getSession falló:', err)
        if (!active) return
        setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    setProfileStatus('loading')
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        AUTH_TIMEOUT_MS,
      )
      if (error) console.error('Error cargando perfil:', error)
      setProfile(data ?? null)
    } catch (err) {
      console.error('Timeout/error cargando perfil:', err)
      setProfile(null)
    } finally {
      setProfileStatus('ready')
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      setProfileStatus('idle')
      return
    }
    void loadProfile(session.user.id)
  }, [session, loadProfile])

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user) await loadProfile(data.user.id)
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    companyId: profile?.company_id ?? null,
    loading,
    profileStatus,
    refreshProfile,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(translateAuthError(error))
    },
    signUp: async (email, password, fullName, companyName) => {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw new Error(translateAuthError(error))

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw new Error(CONFIRM_EMAIL_HINT)
      }

      const { error: setupError } = await supabase.rpc('setup_new_user', {
        p_company_name: companyName,
        p_full_name: fullName,
      })
      if (setupError) {
        const msg = setupError.message ?? ''
        if (msg.includes('function') || msg.includes('schema cache') || msg.includes('does not exist')) {
          throw new Error('Falta ejecutar supabase/schema.sql en el SQL Editor de Supabase.')
        }
        throw new Error(translateAuthError(setupError))
      }

      await refreshProfile()
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [session, profile, loading, profileStatus, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
