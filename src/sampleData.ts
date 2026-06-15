import type { AppState, TrainingExercise } from './types'

const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const isoAtDaysAgo = (days: number, hour: number, minute = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const exercise = (id: string, name: string, values: [number, number][]): TrainingExercise => ({
  id,
  name,
  sets: values.map(([weight, reps], index) => ({
    id: `${id}-set-${index + 1}`,
    setNumber: index + 1,
    weight,
    reps,
    completed: true,
  })),
})

export const initialState: AppState = {
  checkIns: [
    { id: 'checkin-1', date: daysAgo(24), weight: 83.4 },
    { id: 'checkin-2', date: daysAgo(16), weight: 82.7 },
    { id: 'checkin-3', date: daysAgo(8), weight: 81.9 },
    { id: 'checkin-4', date: daysAgo(1), weight: 81.2 },
  ],
  routines: [
    {
      id: 'routine-1',
      name: 'Upper',
      days: ['Lunes', 'Jueves'],
      exercises: [
        { id: 'routine-1-ex-1', name: 'Press banca', sets: 4 },
        { id: 'routine-1-ex-2', name: 'Remo con barra', sets: 4 },
        { id: 'routine-1-ex-3', name: 'Press militar', sets: 3 },
      ],
    },
    {
      id: 'routine-2',
      name: 'Lower',
      days: ['Martes', 'Viernes'],
      exercises: [
        { id: 'routine-2-ex-1', name: 'Sentadilla', sets: 4 },
        { id: 'routine-2-ex-2', name: 'Peso muerto rumano', sets: 3 },
        { id: 'routine-2-ex-3', name: 'Prensa', sets: 3 },
      ],
    },
  ],
  workouts: [
    {
      id: 'workout-1',
      date: daysAgo(10),
      routineId: 'routine-1',
      routineName: 'Upper',
      startedAt: isoAtDaysAgo(10, 7, 10),
      endedAt: isoAtDaysAgo(10, 8, 7),
      durationSeconds: 3420,
      exercises: [
        exercise('workout-1-press', 'Press banca', [
          [80, 6],
          [80, 6],
          [82.5, 5],
          [82.5, 5],
        ]),
        exercise('workout-1-row', 'Remo con barra', [
          [67.5, 8],
          [67.5, 8],
          [70, 8],
          [70, 7],
        ]),
        exercise('workout-1-ohp', 'Press militar', [
          [40, 8],
          [40, 8],
          [42.5, 6],
        ]),
      ],
    },
    {
      id: 'workout-2',
      date: daysAgo(6),
      routineId: 'routine-2',
      routineName: 'Lower',
      startedAt: isoAtDaysAgo(6, 7, 25),
      endedAt: isoAtDaysAgo(6, 8, 36),
      durationSeconds: 4260,
      exercises: [
        exercise('workout-2-squat', 'Sentadilla', [
          [100, 8],
          [105, 8],
          [105, 7],
          [105, 7],
        ]),
        exercise('workout-2-rdl', 'Peso muerto rumano', [
          [90, 10],
          [95, 9],
          [95, 8],
        ]),
        exercise('workout-2-press', 'Prensa', [
          [160, 12],
          [170, 12],
          [170, 10],
        ]),
      ],
    },
    {
      id: 'workout-3',
      date: daysAgo(2),
      routineId: 'routine-1',
      routineName: 'Upper',
      startedAt: isoAtDaysAgo(2, 7, 5),
      endedAt: isoAtDaysAgo(2, 8, 4),
      durationSeconds: 3540,
      exercises: [
        exercise('workout-3-press', 'Press banca', [
          [82.5, 6],
          [82.5, 6],
          [85, 5],
          [85, 4],
        ]),
        exercise('workout-3-row', 'Remo con barra', [
          [70, 8],
          [70, 8],
          [72.5, 7],
          [72.5, 7],
        ]),
        exercise('workout-3-ohp', 'Press militar', [
          [42.5, 8],
          [42.5, 7],
          [42.5, 7],
        ]),
      ],
    },
  ],
}
