import { describe, expect, it } from 'vitest'
import {
  buildCalendarDays,
  formatDuration,
  getFireLevel,
  getEditedWorkoutTiming,
  getFlexibleTrainingStreak,
  getNextRoutineId,
  getWorkoutStartDate,
} from './domain'
import type { Routine, Workout } from './types'

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

const routines: Routine[] = ['push', 'pull', 'legs', 'torso', 'arms'].map((name) => ({
  days: [],
  exercises: [{ id: `${name}-exercise`, name: `${name} exercise`, sets: 1 }],
  id: name,
  name: `${name[0].toUpperCase()}${name.slice(1)}`,
}))

const rotation = ['push', 'pull', 'legs', 'torso', 'arms', 'legs']

const rotationWorkout = (routineId: string, day: number) =>
  makeWorkout({
    date: `2026-07-${String(day).padStart(2, '0')}`,
    id: `workout-${routineId}-${day}`,
    routineId,
    routineName: routines.find((routine) => routine.id === routineId)!.name,
    startedAt: `2026-07-${String(day).padStart(2, '0')}T12:00:00.000Z`,
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
    expect(days[0]).toMatchObject({ dayNumber: null, isCurrentMonth: false, workouts: [] })
    expect(days[1]).toMatchObject({ dayNumber: null, isCurrentMonth: false, workouts: [] })
    expect(days[2]).toMatchObject({ date: '2026-07-01', dayNumber: 1, isCurrentMonth: true })
    expect(days.find((day) => day.dayNumber === 31)).toMatchObject({ date: '2026-07-31', isCurrentMonth: true })
    expect(days.at(-1)).toMatchObject({ dayNumber: null, isCurrentMonth: false, workouts: [] })
    expect(days.find((day) => day.date === '2026-07-10')?.workouts).toEqual([startedWorkout])
    expect(days.find((day) => day.date === '2026-07-12')?.workouts).toEqual([fallbackWorkout])
    expect(getWorkoutStartDate(fallbackWorkout)).toBe('2026-07-12')
  })

  it('uses a real calendar shape without rendering next-month day numbers', () => {
    const days = buildCalendarDays('2026-08', [])

    expect(days).toHaveLength(42)
    expect(days.slice(0, 5).every((day) => day.dayNumber === null)).toBe(true)
    expect(days[5]).toMatchObject({ date: '2026-08-01', dayNumber: 1, isCurrentMonth: true })
    expect(days.find((day) => day.dayNumber === 31)).toMatchObject({ date: '2026-08-31', isCurrentMonth: true })
    expect(days.slice(days.findIndex((day) => day.dayNumber === 31) + 1).every((day) => day.dayNumber === null)).toBe(true)
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

  it('selects the next routine from a rotation', () => {
    expect(getNextRoutineId(routines, rotation, [])).toBe('push')
    expect(getNextRoutineId(routines, rotation, [rotationWorkout('push', 1)])).toBe('pull')
    expect(getNextRoutineId(routines, rotation, [rotationWorkout('arms', 5)])).toBe('legs')
  })

  it('resolves both positions of a repeated Legs routine from recent history', () => {
    expect(
      getNextRoutineId(routines, rotation, [
        rotationWorkout('legs', 3),
        rotationWorkout('pull', 2),
        rotationWorkout('push', 1),
      ]),
    ).toBe('torso')

    expect(
      getNextRoutineId(routines, rotation, [
        rotationWorkout('legs', 6),
        rotationWorkout('arms', 5),
        rotationWorkout('torso', 4),
      ]),
    ).toBe('push')
  })

  it('keeps rotating after several complete cycles without a negative index', () => {
    const history = Array.from({ length: 24 }, (_, index) => rotationWorkout(rotation[index % rotation.length], index + 1))
    expect(getNextRoutineId(routines, rotation, history)).toBe('push')
  })

  it('preserves the exact start time and seconds when only the workout details are edited', () => {
    const workout = makeWorkout({ durationSeconds: 2827 })
    const timing = getEditedWorkoutTiming(workout, getWorkoutStartDate(workout), 47)
    expect(timing.startedAt).toBe(workout.startedAt)
    expect(timing.durationSeconds).toBe(2827)
    expect(new Date(timing.endedAt).getTime() - new Date(timing.startedAt).getTime()).toBe(2827000)
  })
})
