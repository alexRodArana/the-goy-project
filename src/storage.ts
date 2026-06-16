import { initialState } from './sampleData'
import type { ActiveWorkout, AppState, CheckIn, Routine, TrainingExercise, Workout } from './types'

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

const normalizeCheckIns = (value: unknown): CheckIn[] => {
  if (!Array.isArray(value)) {
    return initialState.checkIns
  }

  return value
    .filter(isRecord)
    .map((checkIn, index) => ({
      id: String(checkIn.id ?? `checkin-${index + 1}`),
      date: String(checkIn.date ?? new Date().toISOString().slice(0, 10)),
      weight: toNumber(checkIn.weight),
      photo: typeof checkIn.photo === 'string' ? checkIn.photo : undefined,
    }))
    .filter((checkIn) => checkIn.date && checkIn.weight > 0)
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
              sets: Math.max(1, toNumber(exercise.sets, 3)),
            }))
        : [],
    }))
    .filter((routine) => routine.exercises.length > 0)

  return routines.length ? routines : initialState.routines
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

  return {
    checkIns: normalizeCheckIns(value.checkIns),
    routines: normalizeRoutines(value.routines),
    workouts: normalizeWorkouts(value.workouts),
    activeWorkout: normalizeActiveWorkout(value.activeWorkout),
  }
}

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = action(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export const loadState = async (): Promise<AppState> => {
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

export const loadLocalState = loadState

export const saveState = async (state: AppState) => {
  if (!('indexedDB' in window)) {
    return
  }

  await runTransaction<IDBValidKey>('readwrite', (store) => store.put(state, STATE_KEY))
}

export const saveLocalState = saveState

export const exportState = (state: AppState) => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `the-goy-project-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const parseImportFile = (file: File) =>
  new Promise<AppState>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      try {
        resolve(normalizeState(JSON.parse(String(reader.result))))
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

export const readPhotoAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const original = String(reader.result)
      const image = new Image()

      image.onload = () => {
        const maxSize = 1200
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext('2d')

        if (!context) {
          resolve(original)
          return
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }

      image.onerror = () => resolve(original)
      image.src = original
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
