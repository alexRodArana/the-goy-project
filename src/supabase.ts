import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { initialState } from './sampleData'
import { normalizeState } from './storage'
import type { AppState } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null

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

export const signInWithEmail = async (email: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href.split('#')[0],
    },
  })

  if (error) {
    throw error
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
    .from('goy_app_state')
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

  const { error } = await supabase.from('goy_app_state').upsert(
    {
      user_id: userId,
      state,
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
