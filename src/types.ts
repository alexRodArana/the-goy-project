export type TabKey = 'training' | 'history'


export type RoutineExercise = {
  id: string
  name: string
  sets: number
}

export type Routine = {
  id: string
  name: string
  days: string[]
  exercises: RoutineExercise[]
}

export type TrainingSet = {
  id: string
  setNumber: number
  weight: number | null
  reps: number | null
  completed: boolean
}

export type TrainingExercise = {
  id: string
  name: string
  sets: TrainingSet[]
}

export type CardioSession = {
  incline: number | null
  speed: number | null
  durationMinutes: number | null
  completed: boolean
}

export type ActiveWorkout = {
  id: string
  date: string
  routineId: string
  routineName: string
  startedAt: string
  exercises: TrainingExercise[]
  cardio: CardioSession
}

export type Workout = ActiveWorkout & {
  endedAt: string
  durationSeconds: number
}

export type AppState = {
  cardioEnabled: boolean
  routineRotation: string[]
  routines: Routine[]
  workouts: Workout[]
  activeWorkout?: ActiveWorkout
}

export type RoutineDraftExercise = {
  id: string
  name: string
  sets: number
}
