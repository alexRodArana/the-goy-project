import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { initialState } from './sampleData'
import { normalizeState } from './storage'
import type { AppState } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

const canInitializeSupabase = isValidUrl(supabaseUrl) && Boolean(supabaseAnonKey)
const SHARED_TABLE = 'goy_app_state'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getAuthRedirectUrl = () => {
  const redirectUrl = new URL(window.location.pathname || '/', window.location.origin)
  redirectUrl.hash = ''
  redirectUrl.search = ''

  if (!redirectUrl.pathname.endsWith('/')) {
    redirectUrl.pathname = `${redirectUrl.pathname}/`
  }

  return redirectUrl.toString()
}

const getSupabaseErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Error desconocido de Supabase'
}

export const supabase = (() => {
  if (!canInitializeSupabase) {
    return null
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  } catch (error) {
    console.error('Supabase client could not be initialized', error)
    return null
  }
})()

export const isSupabaseConfigured = Boolean(supabase)

export type SyncSession = Session

export const getSession = async () => {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw error
  }

  return data.session
}

export const onAuthChange = (callback: (session: Session | null) => void) => {
  if (!supabase) {
    return () => undefined
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session))

  return () => subscription.unsubscribe()
}

export const signInWithEmail = async (email: string, password: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(getSupabaseErrorMessage(error))
  }
}

export const signUpWithEmail = async (email: string, password: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  })

  if (signUpError) {
    throw new Error(getSupabaseErrorMessage(signUpError))
  }
}

export const signOut = async () => {
  if (!supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

export const loadRemoteState = async (userId: string): Promise<AppState> => {
  if (!supabase) {
    return initialState
  }

  const { data, error } = await supabase
    .from(SHARED_TABLE)
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeState(data?.state ?? initialState)
}

export const saveRemoteState = async (userId: string, state: AppState) => {
  if (!supabase) {
    return
  }

  const { data, error: readError } = await supabase.from(SHARED_TABLE).select('state').eq('user_id', userId).maybeSingle()

  if (readError) {
    throw readError
  }

  const sharedState = isRecord(data?.state) ? data.state : {}
  const nextState = {
    ...sharedState,
    ...state,
  }

  const { error } = await supabase.from(SHARED_TABLE).upsert(
    {
      user_id: userId,
      state: nextState,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    },
  )

  if (error) {
    throw error
  }
}
