import { describe, expect, it } from 'vitest'
import { normalizeState } from './storage'

describe('normalizeState', () => {
  it('keeps cardio enabled for existing accounts without a preference', () => {
    expect(normalizeState({ routines: [], workouts: [] }).cardioEnabled).toBe(true)
  })

  it('preserves a disabled cardio preference', () => {
    expect(normalizeState({ cardioEnabled: false, routines: [], workouts: [] }).cardioEnabled).toBe(false)
  })

  it('builds a default rotation and preserves valid duplicate routine entries', () => {
    const routines = [
      { id: 'push', name: 'Push', days: [], exercises: [{ id: 'push-1', name: 'Press', sets: 2 }] },
      { id: 'legs', name: 'Legs', days: [], exercises: [{ id: 'legs-1', name: 'Squat', sets: 2 }] },
    ]

    expect(normalizeState({ routines, workouts: [] }).routineRotation).toEqual(['push', 'legs'])
    expect(
      normalizeState({ routineRotation: ['push', 'legs', 'missing', 'legs'], routines, workouts: [] })
        .routineRotation,
    ).toEqual(['push', 'legs', 'legs'])
  })
})
