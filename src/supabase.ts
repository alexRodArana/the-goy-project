import { createClient } from '@supabase/supabase-js'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
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
const TRAINING_STATE_KEYS = ['routines', 'workouts', 'activeWorkout', 'cardioEnabled']

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

const supabase = (() => {
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
export type SyncAuthEvent = AuthChangeEvent

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

export const onAuthChange = (callback: (session: Session | null, event: AuthChangeEvent) => void) => {
  if (!supabase) {
    return () => undefined
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => callback(session, event))

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

export const requestPasswordReset = async (email: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  })

  if (error) {
    throw new Error(getSupabaseErrorMessage(error))
  }
}

export const updatePassword = async (password: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    throw new Error(getSupabaseErrorMessage(error))
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

export const loadRemoteState = async (): Promise<AppState> => {
  if (!supabase) {
    return initialState
  }

  const { data, error } = await supabase.rpc('get_goy_app_state_sections', {
    p_keys: TRAINING_STATE_KEYS,
  })

  if (error) {
    throw error
  }

  return normalizeState(data ?? initialState)
}

export const saveRemoteState = async (state: AppState, previousState?: AppState) => {
  if (!supabase) {
    return
  }

  const patch: Record<string, unknown> = {}
  if (!previousState || state.cardioEnabled !== previousState.cardioEnabled) {
    patch.cardioEnabled = state.cardioEnabled
  }
  if (!previousState || state.routines !== previousState.routines) {
    patch.routines = state.routines
  }
  if (!previousState || state.workouts !== previousState.workouts) {
    patch.workouts = state.workouts
  }
  if (!previousState || state.activeWorkout !== previousState.activeWorkout) {
    patch.activeWorkout = state.activeWorkout ?? null
  }

  if (!Object.keys(patch).length) {
    return
  }

  const { error } = await supabase.rpc('merge_goy_app_state', {
    p_patch: patch,
    p_remove_keys: ['checkIns'],
  })

  if (error) {
    throw error
  }
}
