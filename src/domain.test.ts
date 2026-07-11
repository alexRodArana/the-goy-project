import { describe, expect, it } from 'vitest'
import {
  buildCalendarDays,
  formatDuration,
  getFireLevel,
  getFlexibleTrainingStreak,
  getWorkoutStartDate,
} from './domain'
import type { Workout } from './types'

const makeWorkout = (patch: Partial<Workout> = {}): Workout => ({
  cardio: {
    completed: false,
    durationMinutes: null,
    incline: null,
    speed: null,
  },
  date: '2026-07-10',
  durationSeconds: 2820,
  endedAt: '2026-07-10T13:47:00.000Z',
  exercises: [
    {
      id: 'exercise-1',
      name: 'Press banca',
      sets: [
        {
          completed: true,
          id: 'set-1',
          reps: 10,
          setNumber: 1,
          weight: 80,
        },
      ],
    },
  ],
  id: 'workout-1',
  routineId: 'routine-1',
  routineName: 'Push',
  startedAt: '2026-07-10T13:00:00.000Z',
  ...patch,
})

describe('domain helpers', () => {
  it('groups calendar workouts by the workout start date', () => {
    const startedWorkout = makeWorkout()
    const fallbackWorkout = makeWorkout({
      date: '2026-07-12',
      id: 'workout-2',
      startedAt: 'invalid-date',
    })

    const days = buildCalendarDays('2026-07', [startedWorkout, fallbackWorkout])

    expect(days).toHaveLength(35)
    expect(days[0]).toMatchObject({ date: '2026-07-01', dayNumber: 1, isCurrentMonth: true })
    expect(days.find((day) => day.dayNumber === 31)).toMatchObject({ date: '2026-07-31', isCurrentMonth: true })
    expect(days.at(-1)).toMatchObject({ dayNumber: null, isCurrentMonth: false, workouts: [] })
    expect(days.find((day) => day.date === '2026-07-10')?.workouts).toEqual([startedWorkout])
    expect(days.find((day) => day.date === '2026-07-12')?.workouts).toEqual([fallbackWorkout])
    expect(getWorkoutStartDate(fallbackWorkout)).toBe('2026-07-12')
  })

  it('allows up to two rest days while calculating the active streak', () => {
    const workouts = [
      makeWorkout({ date: '2026-07-10', id: 'workout-10', startedAt: '2026-07-10T12:00:00.000Z' }),
      makeWorkout({ date: '2026-07-07', id: 'workout-7', startedAt: '2026-07-07T12:00:00.000Z' }),
      makeWorkout({ date: '2026-07-04', id: 'workout-4', startedAt: '2026-07-04T12:00:00.000Z' }),
      makeWorkout({ date: '2026-06-28', id: 'workout-old', startedAt: '2026-06-28T12:00:00.000Z' }),
    ]

    expect(getFlexibleTrainingStreak(workouts, '2026-07-10')).toBe(3)
    expect(getFlexibleTrainingStreak(workouts, '2026-07-14')).toBe(0)
  })

  it('formats durations and maps streaks to fire levels', () => {
    expect(formatDuration(3661)).toBe('01:01:01')
    expect(formatDuration(-20)).toBe('00:00:00')
    expect(getFireLevel(0)).toBe(0)
    expect(getFireLevel(1)).toBe(1)
    expect(getFireLevel(13)).toBe(5)
  })
})
