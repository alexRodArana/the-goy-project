import { initialState } from './sampleData'
import type { ActiveWorkout, AppState, CardioSession, Routine, TrainingExercise, Workout } from './types'

const DB_NAME = 'the-goy-project-db-v2'
const DB_VERSION = 1
const STORE_NAME = 'state'
const STATE_KEY = 'app'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toNumber = (value: unknown, fallback = 0) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

const toStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : []

const emptyCardio = (): CardioSession => ({
  incline: null,
  speed: null,
  durationMinutes: null,
  completed: false,
})

const normalizeNullableNumber = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : toNumber(value)

const normalizeCardio = (value: unknown): CardioSession => {
  if (!isRecord(value)) {
    return emptyCardio()
  }

  return {
    incline: normalizeNullableNumber(value.incline),
    speed: normalizeNullableNumber(value.speed),
    durationMinutes: normalizeNullableNumber(value.durationMinutes ?? value.time ?? value.minutes),
    completed: Boolean(value.completed),
  }
}

const normalizeRoutines = (value: unknown): Routine[] => {
  if (!Array.isArray(value)) {
    return initialState.routines
  }

  const routines = value
    .filter(isRecord)
    .map((routine, routineIndex) => ({
      id: String(routine.id ?? `routine-${routineIndex + 1}`),
      name: String(routine.name ?? 'Rutina'),
      days: toStringArray(routine.days),
      exercises: Array.isArray(routine.exercises)
        ? routine.exercises
            .filter(isRecord)
            .map((exercise, exerciseIndex) => ({
              id: String(exercise.id ?? `routine-${routineIndex + 1}-exercise-${exerciseIndex + 1}`),
              name: String(exercise.name ?? exercise.exerciseName ?? `Ejercicio ${exerciseIndex + 1}`),
              sets: Math.min(30, Math.max(1, Math.trunc(toNumber(exercise.sets, 3)))),
            }))
        : [],
    }))
    .filter((routine) => routine.exercises.length > 0)

  return routines.length ? routines : initialState.routines
}

const normalizeRoutineRotation = (value: unknown, routines: Routine[]) => {
  const routineIds = new Set(routines.map((routine) => routine.id))
  const rotation = toStringArray(value).filter((routineId) => routineIds.has(routineId))
  return rotation.length ? rotation : routines.map((routine) => routine.id)
}

const normalizeExerciseSets = (
  exerciseId: string,
  rawSets: unknown,
  fallbackCount = 1,
): TrainingExercise['sets'] => {
  if (Array.isArray(rawSets)) {
    return rawSets.filter(isRecord).map((set, index) => ({
      id: String(set.id ?? `${exerciseId}-set-${index + 1}`),
      setNumber: Math.max(1, toNumber(set.setNumber, index + 1)),
      weight: set.weight === null || set.weight === undefined ? null : toNumber(set.weight),
      reps: set.reps === null || set.reps === undefined ? null : toNumber(set.reps),
      completed: Boolean(set.completed ?? true),
    }))
  }

  return Array.from({ length: Math.max(1, fallbackCount) }, (_, index) => ({
    id: `${exerciseId}-set-${index + 1}`,
    setNumber: index + 1,
    weight: null,
    reps: null,
    completed: false,
  }))
}

const normalizeWorkoutExercises = (workout: Record<string, unknown>, workoutIndex: number) => {
  if (Array.isArray(workout.exercises)) {
    return workout.exercises
      .filter(isRecord)
      .map((exercise, exerciseIndex) => {
        const id = String(exercise.id ?? `workout-${workoutIndex + 1}-exercise-${exerciseIndex + 1}`)

        return {
      id,
      name: String(exercise.name ?? exercise.exerciseName ?? `Ejercicio ${exerciseIndex + 1}`),
      sets: normalizeExerciseSets(id, exercise.sets),
    }
      })
      .filter((exercise) => exercise.sets.length > 0)
  }

  if (Array.isArray(workout.sets)) {
    return workout.sets
      .filter(isRecord)
      .map((set, index) => {
        const id = String(set.id ?? `legacy-workout-${workoutIndex + 1}-exercise-${index + 1}`)
        const setCount = Math.max(1, toNumber(set.sets, 1))

        return {
          id,
          name: String(set.exerciseName ?? `Ejercicio ${index + 1}`),
          sets: Array.from({ length: setCount }, (_, setIndex) => ({
            id: `${id}-set-${setIndex + 1}`,
            setNumber: setIndex + 1,
            weight: toNumber(set.weight),
            reps: toNumber(set.reps),
            completed: true,
          })),
        }
      })
      .filter((exercise) => exercise.sets.length > 0)
  }

  return []
}

const normalizeWorkoutBase = (
  workout: Record<string, unknown>,
  index: number,
): Omit<ActiveWorkout, 'exercises'> & { exercises: TrainingExercise[] } => {
  const date = String(workout.date ?? new Date().toISOString().slice(0, 10))
  const startedAt = String(workout.startedAt ?? `${date}T12:00:00.000Z`)

  return {
    id: String(workout.id ?? `workout-${index + 1}`),
    date,
    routineId: String(workout.routineId ?? ''),
    routineName: String(workout.routineName ?? workout.title ?? 'Entrenamiento'),
    startedAt,
    exercises: normalizeWorkoutExercises(workout, index),
    cardio: normalizeCardio(workout.cardio),
  }
}

const normalizeWorkouts = (value: unknown): Workout[] => {
  if (!Array.isArray(value)) {
    return initialState.workouts
  }

  return value
    .filter(isRecord)
    .map((workout, index) => {
      const base = normalizeWorkoutBase(workout, index)
      const endedAt = String(workout.endedAt ?? base.startedAt)
      const legacyDuration = toNumber(workout.duration, 0) * 60

      return {
        ...base,
        endedAt,
        durationSeconds: toNumber(workout.durationSeconds, legacyDuration),
      }
    })
    .filter((workout) => workout.exercises.length > 0)
}

const normalizeActiveWorkout = (value: unknown): ActiveWorkout | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const workout = normalizeWorkoutBase(value, 0)
  return workout.exercises.length ? workout : undefined
}

export const normalizeState = (value: unknown): AppState => {
  if (!isRecord(value)) {
    return initialState
  }

  const routines = normalizeRoutines(value.routines)

  return {
    cardioEnabled: value.cardioEnabled !== false,
    routineRotation: normalizeRoutineRotation(value.routineRotation, routines),
    routines,
    workouts: normalizeWorkouts(value.workouts),
    activeWorkout: normalizeActiveWorkout(value.activeWorkout),
  }
}

let databasePromise: Promise<IDBDatabase> | undefined

const openDatabase = () => {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }

    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = undefined
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = undefined
      reject(request.error)
    }
  })

  return databasePromise
}

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = action(store)
    let result!: T

    request.onsuccess = () => {
      result = request.result
    }
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export const loadLocalState = async (): Promise<AppState> => {
  if (!('indexedDB' in window)) {
    return initialState
  }

  try {
    const state = await runTransaction<unknown>('readonly', (store) =>
      store.get(STATE_KEY),
    )

    return normalizeState(state)
  } catch (error) {
    console.error('Could not load local state', error)
    return initialState
  }
}
