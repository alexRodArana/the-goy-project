import { describe, expect, it } from 'vitest'
import { normalizeState } from './storage'

describe('normalizeState', () => {
  it('keeps cardio enabled for existing accounts without a preference', () => {
    expect(normalizeState({ routines: [], workouts: [] }).cardioEnabled).toBe(true)
  })

  it('preserves a disabled cardio preference', () => {
    expect(normalizeState({ cardioEnabled: false, routines: [], workouts: [] }).cardioEnabled).toBe(false)
  })
})
