import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useSyncedState } from './useSyncedState'

type State = { workouts: { id: string; value: number }[] }
const user = (id: string) => ({ user: { id }, access_token: `token-${id}` } as Session)

function setup() {
  let listener: (session: Session | null, event: AuthChangeEvent) => void = () => undefined
  const initialState: State = { workouts: [] }
  const saved: State = { workouts: [{ id: 'alice-record', value: 1 }] }
  const options = {
    initialState, configured: true,
    cache: { read: vi.fn< (owner: string | null) => Promise<{ state: State; base?: State } | undefined> >(async () => undefined), write: vi.fn(async () => undefined) },
    loadGuest: vi.fn(() => initialState),
    getSession: vi.fn(async () => user('alice')),
    subscribe: vi.fn((callback: typeof listener) => { listener = callback; return () => undefined }),
    load: vi.fn(async () => saved),
    save: vi.fn< (state: State, previous: State | undefined, owner: string) => Promise<void> >(async () => undefined),
  }
  return { options, saved, auth: (session: Session | null, event: AuthChangeEvent = 'SIGNED_IN') => listener(session, event) }
}

describe('session synchronization', () => {
  it('rechecks authentication when retrying a failed initial session lookup', async () => {
    const { options, saved } = setup()
    options.getSession.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useSyncedState(options))
    await waitFor(() => expect(result.current.syncStatus).toBe('error'))
    await act(async () => { await result.current.retrySync() })
    expect(result.current.state).toEqual(saved)
    expect(options.getSession).toHaveBeenCalledTimes(2)
  })

  it('reports offline edits as pending while retaining them in the account cache', async () => {
    const { options, saved } = setup()
    const { result } = renderHook(() => useSyncedState(options))
    await waitFor(() => expect(result.current.state).toEqual(saved))
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      await act(async () => {
        result.current.setState({ workouts: [{ id: 'offline', value: 3 }] })
        await result.current.flush()
      })
      expect(result.current.syncStatus).toBe('error')
      expect(options.save).not.toHaveBeenCalled()
      expect(options.cache.write).toHaveBeenCalled()
    } finally { online.mockRestore() }
  })

  it('hydrates under StrictMode and ignores repeated sign-in/token refresh events for the same account', async () => {
    const { options, saved, auth } = setup()
    const { result } = renderHook(() => useSyncedState(options), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.state).toEqual(saved))
    act(() => { auth(user('alice'), 'TOKEN_REFRESHED'); auth(user('alice')) })
    await act(async () => { await result.current.flush() })
    expect(options.load).toHaveBeenCalledTimes(1)
    expect(options.save).not.toHaveBeenCalled()
  })

  it('clears private data on sign-out and never uploads it into a different account', async () => {
    const { options, saved, auth } = setup()
    const { result } = renderHook(() => useSyncedState(options))
    await waitFor(() => expect(result.current.state).toEqual(saved))
    await act(async () => { auth(null, 'SIGNED_OUT') })
    expect(result.current.state).toEqual(options.initialState)
    options.load.mockResolvedValue({ workouts: [] })
    await act(async () => { auth(user('bob')) })
    expect(result.current.state.workouts).toEqual([])
    expect(options.cache.read).toHaveBeenCalledWith('bob')
    expect(options.save).not.toHaveBeenCalled()
  })

  it('keeps offline edits and merges them after reconnection without overwriting other records', async () => {
    const { options, saved } = setup()
    options.cache.read.mockResolvedValue({ state: saved, base: saved })
    options.load.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useSyncedState(options))
    await waitFor(() => expect(result.current.syncStatus).toBe('error'))
    await act(async () => {
      result.current.setState({ workouts: [...saved.workouts, { id: 'offline', value: 2 }] })
      await result.current.flush()
    })
    expect(options.save).not.toHaveBeenCalled()
    options.load.mockResolvedValue({ workouts: [...saved.workouts, { id: 'other-device', value: 3 }] })
    await act(async () => { await result.current.retrySync() })
    await waitFor(() => expect(options.save).toHaveBeenCalled())
    expect(result.current.state.workouts.map((item) => item.id)).toEqual(['alice-record', 'other-device', 'offline'])
  })

  it('ignores a response from an account that has already been switched out', async () => {
    const { options, auth, saved } = setup()
    let resolveOld!: (state: State) => void
    options.load.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    const { result } = renderHook(() => useSyncedState(options))
    await waitFor(() => expect(options.load).toHaveBeenCalledOnce())
    options.load.mockResolvedValue({ workouts: [{ id: 'bob-record', value: 2 }] })
    await act(async () => { auth(user('bob')) })
    await act(async () => { resolveOld(saved) })
    expect(result.current.state.workouts[0].id).toBe('bob-record')
    expect(result.current.session?.user.id).toBe('bob')
  })

  it('serializes saves and includes edits made while a request is in flight', async () => {
    const { options, saved } = setup()
    let finishSave!: () => void
    options.save.mockImplementationOnce(() => new Promise((resolve) => { finishSave = () => resolve(undefined) }))
    const { result } = renderHook(() => useSyncedState(options))
    await waitFor(() => expect(result.current.state).toEqual(saved))
    act(() => result.current.setState({ workouts: [...saved.workouts, { id: 'first', value: 1 }] }))
    let pending!: Promise<void>
    act(() => { pending = result.current.flush() })
    await waitFor(() => expect(options.save).toHaveBeenCalledOnce())
    act(() => result.current.setState((state) => ({ workouts: [...state.workouts, { id: 'second', value: 2 }] })))
    await act(async () => { finishSave(); await pending })
    expect(options.save).toHaveBeenCalledTimes(2)
    expect(options.save.mock.calls[1][0].workouts).toHaveLength(3)
    expect(options.save.mock.calls[1][2]).toBe('alice')
  })
})
