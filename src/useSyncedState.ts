import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { CachedState } from './localCache'
import { buildStatePatch, hasStateChanges, mergePendingState } from './stateSync'

export type SyncStatus = 'local' | 'loading' | 'synced' | 'sent' | 'error'
type Options<T> = {
  initialState: T
  configured: boolean
  cache: {
    read: (owner: string | null) => Promise<CachedState<T> | undefined>
    write: (owner: string | null, value: CachedState<T>) => Promise<void>
  }
  loadGuest: () => T | Promise<T>
  getSession: () => Promise<Session | null>
  subscribe: (callback: (session: Session | null, event: AuthChangeEvent) => void) => () => void
  load: () => Promise<T>
  save: (state: T, previous: T | undefined, owner: string) => Promise<void>
}

const withTimeout = <T,>(operation: Promise<T>, milliseconds = 8000) => new Promise<T>((resolve, reject) => {
  const timer = window.setTimeout(() => reject(new Error('La conexión tardó demasiado.')), milliseconds)
  operation.then(
    (value) => { window.clearTimeout(timer); resolve(value) },
    (error: unknown) => { window.clearTimeout(timer); reject(error) },
  )
})

export function useSyncedState<T extends object>(options: Options<T>) {
  const [state, renderState] = useState(options.initialState)
  const [session, renderSession] = useState<Session | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const [syncMessage, setSyncMessage] = useState('')
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery',
  )
  const model = useRef({
    state: options.initialState, base: undefined as T | undefined,
    session: null as Session | null, ready: false, remoteReady: false,
    generation: 0, active: false, loading: false,
    saving: undefined as Promise<void> | undefined,
  })

  const reportError = useCallback((message: string) => {
    if (!model.current.active) return
    setSyncStatus('error')
    setSyncMessage(message)
  }, [])

  const persist = useCallback(async () => {
    const current = model.current
    if (!current.ready) return
    try {
      await options.cache.write(current.session?.user.id ?? null, { state: current.state, base: current.base })
    } catch {
      reportError('No se pudo guardar en este dispositivo.')
    }
  }, [options, reportError])

  const setState: Dispatch<SetStateAction<T>> = useCallback((update) => {
    const current = model.current
    if (!current.ready) return
    const next = typeof update === 'function' ? (update as (state: T) => T)(current.state) : update
    current.state = next
    renderState(next)
  }, [])

  const flush = useCallback(async () => {
    const current = model.current
    await persist()
    if (!current.session) return
    if (!navigator.onLine) {
      if (hasStateChanges(buildStatePatch(current.state, current.base))) reportError('Cambios guardados aquí. Pendientes de sincronizar.')
      return
    }
    if (!current.remoteReady || current.loading) return
    if (current.saving) return current.saving
    const generation = current.generation
    const owner = current.session.user.id
    const operation = async () => {
      try {
        while (current.active && current.generation === generation && hasStateChanges(buildStatePatch(current.state, current.base))) {
          const snapshot = current.state
          await options.save(snapshot, current.base, owner)
          if (current.generation !== generation) return
          current.base = snapshot
          await persist()
        }
        if (current.active && current.generation === generation) {
          setSyncStatus('synced')
          setSyncMessage('')
        }
      } catch {
        if (current.generation === generation) reportError('Cambios guardados aquí. Pendientes de sincronizar.')
      }
    }
    const promise = operation()
    current.saving = promise
    await promise
    if (current.saving === promise) current.saving = undefined
  }, [options, persist, reportError])

  const hydrateSessionState = useCallback(async (nextSession: Session | null, force = false) => {
    const current = model.current
    const sameOwner = current.ready && current.session?.user.id === nextSession?.user.id
    if (sameOwner && !force && (current.remoteReady || !nextSession)) {
      current.session = nextSession
      renderSession(nextSession)
      return
    }
    if (sameOwner && current.loading) return
    await persist()
    if (sameOwner) await current.saving
    const generation = ++current.generation
    current.session = nextSession
    current.loading = true
    current.remoteReady = false
    renderSession(nextSession)
    setSyncStatus(nextSession ? 'loading' : 'local')
    setSyncMessage('')
    if (!sameOwner) {
      current.ready = false
      current.base = undefined
      current.state = options.initialState
      renderState(options.initialState)
      setIsLoaded(false)
    }
    const valid = () => current.active && generation === current.generation
    try {
      if (!sameOwner) {
        const cached = await options.cache.read(nextSession?.user.id ?? null).catch(() => undefined)
        if (!valid()) return
        current.state = cached?.state ?? (!nextSession && !options.configured ? await options.loadGuest() : options.initialState)
        current.base = cached?.base ?? (nextSession ? options.initialState : undefined)
        if (!valid()) return
        current.ready = true
        renderState(current.state)
        if (cached || !nextSession) setIsLoaded(true)
      }
      if (!nextSession) return
      const remote = await withTimeout(options.load())
      if (!valid()) return
      const merged = current.base ? mergePendingState(remote, current.state, current.base) : remote
      current.base = remote
      current.state = merged
      current.remoteReady = true
      renderState(merged)
      setSyncStatus('synced')
      setSyncMessage('')
      await persist()
    } catch {
      if (valid()) reportError('Sin conexión. Mostrando los datos de esta cuenta guardados aquí.')
    } finally {
      if (valid()) {
        current.loading = false
        current.ready = true
        setIsLoaded(true)
        if (current.remoteReady) void flush()
      }
    }
  }, [options, persist, flush, reportError])

  useEffect(() => {
    const current = model.current
    current.active = true
    let mounted = true
    let authObserved = false
    const unsubscribe = options.subscribe((nextSession, event) => {
      if (!mounted) return
      authObserved = true
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
      void hydrateSessionState(nextSession)
    })
    void (async () => {
      try {
        const initialSession = options.configured ? await withTimeout(options.getSession()) : null
        if (mounted && !authObserved) await hydrateSessionState(initialSession)
      } catch {
        if (mounted && !authObserved) {
          await hydrateSessionState(null)
          reportError('No se pudo comprobar la cuenta. Intenta conectar de nuevo.')
        }
      }
    })()
    const resume = () => {
      if (document.visibilityState !== 'hidden' && current.ready && current.session) {
        void hydrateSessionState(current.session, true)
      }
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') void flush()
      else resume()
    }
    const pageHide = () => { void persist() }
    window.addEventListener('online', resume)
    window.addEventListener('pagehide', pageHide)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      mounted = false
      void persist()
      current.active = false
      current.loading = false
      current.generation += 1
      unsubscribe()
      window.removeEventListener('online', resume)
      window.removeEventListener('pagehide', pageHide)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [options, hydrateSessionState, persist, flush, reportError])

  useEffect(() => {
    if (!isLoaded) return
    const localTimer = window.setTimeout(() => { void persist() }, 40)
    const remoteTimer = window.setTimeout(() => { void flush() }, 500)
    return () => { window.clearTimeout(localTimer); window.clearTimeout(remoteTimer) }
  }, [isLoaded, state, persist, flush])

  const retrySync = useCallback(async () => {
    try {
      const nextSession = model.current.session ?? (options.configured ? await withTimeout(options.getSession()) : null)
      await hydrateSessionState(nextSession, true)
    } catch {
      reportError('No se pudo comprobar la cuenta. Intenta conectar de nuevo.')
    }
  }, [hydrateSessionState, options, reportError])
  return {
    state, setState, session, isLoaded, syncStatus, setSyncStatus, syncMessage, setSyncMessage,
    isPasswordRecovery, setIsPasswordRecovery, hydrateSessionState, retrySync, flush,
  }
}
