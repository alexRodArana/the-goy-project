import { describe, expect, it } from 'vitest'
import { buildStatePatch, mergePendingState } from './stateSync'

describe('incremental state changes', () => {
  it('sends one new workout rather than the whole history', () => {
    const previous = { workouts: Array.from({ length: 500 }, (_, id) => ({ id: String(id), sets: Array(20).fill(80) })) }
    const next = { workouts: [{ id: 'new', sets: [90] }, ...previous.workouts] }
    const changes = buildStatePatch(next, previous)
    expect(changes).toEqual({ patch: {}, changes: { workouts: { upsert: [{ id: 'new', sets: [90] }], remove: [] } } })
    expect(JSON.stringify(changes).length).toBeLessThan(JSON.stringify(next).length / 100)
  })

  it('merges offline additions, edits and deletions without losing another device\'s records', () => {
    const base = { workouts: [{ id: 'edit', value: 1 }, { id: 'delete', value: 1 }] }
    const remote = { workouts: [...base.workouts, { id: 'other-device', value: 2 }] }
    const local = { workouts: [{ id: 'edit', value: 3 }, { id: 'offline', value: 4 }] }
    expect(mergePendingState(remote, local, base).workouts).toEqual([
      { id: 'edit', value: 3 }, { id: 'other-device', value: 2 }, { id: 'offline', value: 4 },
    ])
  })

  it('identifies a meal session by meal and day to avoid counting duplicates', () => {
    const session = { id: 'one-device', mealId: 'breakfast', date: '2026-09-05', completed: false }
    const base = { sessions: [session] }
    const local = { sessions: [{ ...session, id: 'another-device', completed: true }] }
    expect(mergePendingState(base, local, base).sessions).toEqual(local.sessions)
  })

  it('preserves repeated rotation slots and explicit false/null preferences', () => {
    expect(buildStatePatch({ routineRotation: ['legs', 'arms', 'legs'], cardioEnabled: false, activeWorkout: undefined },
      { routineRotation: ['legs'], cardioEnabled: true, activeWorkout: { id: 'a' } } as never)).toEqual({
      changes: {}, patch: { routineRotation: ['legs', 'arms', 'legs'], cardioEnabled: false, activeWorkout: null },
    })
  })

  it('does not send structurally identical data restored from local storage', () => {
    const state = { workouts: [{ id: '1', weight: 42 }] }
    expect(buildStatePatch(state, structuredClone(state))).toEqual({ patch: {}, changes: {} })
  })
})
