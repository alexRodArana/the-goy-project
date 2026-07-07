import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  ChangeEvent,
  Dispatch,
  FocusEvent as ReactFocusEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SetStateAction,
} from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Dumbbell,
  Flame,
  History,
  KeyRound,
  Mail,
  Moon,
  Palette,
  Pencil,
  Play,
  Plus,
  Save,
  Sun,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './App.css'
import { initialState } from './sampleData'
import { loadLocalState, readPhotoAsDataUrl, saveLocalState } from './storage'
import {
  getSession,
  isSupabaseConfigured,
  loadRemoteState,
  onAuthChange,
  requestPasswordReset,
  saveRemoteState,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
  type SyncSession,
} from './supabase'
import type {
  ActiveWorkout,
  AppState,
  CardioSession,
  CheckIn,
  Routine,
  RoutineDraftExercise,
  TabKey,
  ThemeMode,
  TrainingExercise,
  Workout,
} from './types'

type RoutineMode = 'home' | 'create' | 'edit'

type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'rose'

type AccentOption = {
  key: AccentColor
  label: string
  color: string
}

type CalendarDay = {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  workouts: Workout[]
}

type RoutineDraft = {
  name: string
  days: string
  exercises: RoutineDraftExercise[]
}

type WorkoutDraftSet = {
  id: string
  setNumber: number
  weight: number | null
  reps: number | null
  completed: boolean
}

type WorkoutDraftExercise = {
  id: string
  name: string
  sets: WorkoutDraftSet[]
}

type WorkoutDraft = {
  date: string
  routineName: string
  durationMinutes: number
  exercises: WorkoutDraftExercise[]
  cardio: CardioSession
}

type CheckInDraft = {
  date: string
  weight: number
  photo: string
}

type FinishSummary = {
  id: string
  message: string
  streak: number
}

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const todayIso = () => toDateKey(new Date())

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const toLocalDate = (value: string) => new Date(`${value}T12:00:00`)

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const getWorkoutStartDate = (workout: Workout) => {
  const startedAt = new Date(workout.startedAt)
  return Number.isNaN(startedAt.getTime()) ? workout.date : toDateKey(startedAt)
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(toLocalDate(value))

const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(toLocalDate(value))

const formatMonth = (value: string) => {
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(toLocalDate(value))
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const rest = safeSeconds % 60

  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':')
}

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('es-MX')

const addMonths = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return toMonthKey(date)
}

const formatMonthKey = (monthKey: string) => formatMonth(`${monthKey}-01`)

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const dayDifference = (laterDate: string, earlierDate: string) =>
  Math.round((toLocalDate(laterDate).getTime() - toLocalDate(earlierDate).getTime()) / 86_400_000)

const completionMessages = ['Bien hecho.', 'Buen trabajo.', 'Rutina completada.', 'Trabajo limpio.', 'Entreno cerrado.']

const getFlexibleTrainingStreak = (workouts: Workout[], referenceDate = todayIso()) => {
  const dates = [...new Set(workouts.map(getWorkoutStartDate).filter((date) => date <= referenceDate))].sort((a, b) =>
    b.localeCompare(a),
  )

  const latestDate = dates[0]
  if (!latestDate || dayDifference(referenceDate, latestDate) > 3) {
    return 0
  }

  let streak = 1
  for (let index = 1; index < dates.length; index += 1) {
    if (dayDifference(dates[index - 1], dates[index]) > 3) {
      break
    }
    streak += 1
  }

  return streak
}

const getFireLevel = (streak: number) => (streak <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil(streak / 3))))

const selectInputValue = (event: ReactFocusEvent<HTMLInputElement>) => {
  const input = event.currentTarget
  window.requestAnimationFrame(() => {
    try {
      input.select()
    } catch {
      // Some mobile browsers do not expose text selection for numeric inputs.
    }
  })
}

const numericInputProps = {
  autoComplete: 'off',
  enterKeyHint: 'done',
  onFocus: selectInputValue,
} as const

const navItems: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'training', label: 'Training', icon: Dumbbell },
  { key: 'history', label: 'Historial', icon: History },
  { key: 'timeline', label: 'Timeline', icon: Camera },
]

const brandMarkSrc = `${import.meta.env.BASE_URL}app-icon-192.png`
const accentOptions: AccentOption[] = [
  { key: 'green', label: 'Verde', color: '#39b980' },
  { key: 'blue', label: 'Azul', color: '#2563eb' },
  { key: 'purple', label: 'Morado', color: '#7c3aed' },
  { key: 'orange', label: 'Naranja', color: '#d97706' },
  { key: 'rose', label: 'Rosa', color: '#be185d' },
]

const trainingPhrases = [
  'Goy mode off, disciplina Judia on.',
  'Del Goy al modo Kosher, una serie a la vez.',
  'Hoy el Goy entrena con enfoque Judio.',
  'Rutina Kosher para domar al Goy interior.',
  'Goy Project: reps limpias, mente Kosher.',
  'El Goy no negocia, el modo Judio ejecuta.',
  'Que el Goy sude y el modo Kosher mande.',
  'Goy de entrada, Kosher de salida.',
]

const tabFromHash = (): TabKey => {
  const key = window.location.hash.replace('#', '')
  return navItems.some((item) => item.key === key) ? (key as TabKey) : 'training'
}

const hasPasswordRecoveryParams = () => {
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.replace(/^#/, '')}`)
  return params.get('type') === 'recovery'
}

const clearPasswordRecoveryUrl = () => {
  if (hasPasswordRecoveryParams()) {
    window.history.replaceState(null, '', window.location.pathname)
  }
}

const createRoutineExercise = (name = ''): RoutineDraftExercise => ({
  id: createId('draft-exercise'),
  name,
  sets: 3,
})

const routineToDraft = (routine?: Routine): RoutineDraft => ({
  name: routine?.name ?? '',
  days: routine?.days.join(', ') ?? '',
  exercises: routine?.exercises.length
    ? routine.exercises.map((exercise) => ({ ...exercise }))
    : [createRoutineExercise()],
})

const createWorkoutDraftSet = (setNumber = 1): WorkoutDraftSet => ({
  id: createId('workout-set'),
  setNumber,
  weight: null,
  reps: null,
  completed: false,
})

const createWorkoutDraftExercise = (name = ''): WorkoutDraftExercise => ({
  id: createId('workout-exercise'),
  name,
  sets: [createWorkoutDraftSet()],
})

const workoutToDraft = (workout: Workout): WorkoutDraft => ({
  date: workout.date,
  routineName: workout.routineName,
  durationMinutes: Math.max(1, Math.round(workout.durationSeconds / 60)),
  exercises: workout.exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    sets: exercise.sets.map((set) => ({ ...set })),
  })),
  cardio: workout.cardio ?? emptyCardio(),
})

const draftToWorkout = (workout: Workout, draft: WorkoutDraft): Workout => {
  const durationSeconds = Math.max(1, Math.round(Number(draft.durationMinutes) * 60))
  const startedAt = `${draft.date}T12:00:00.000Z`
  const endedAt = new Date(new Date(startedAt).getTime() + durationSeconds * 1000).toISOString()

  return {
    ...workout,
    date: draft.date,
    routineName: draft.routineName.trim() || workout.routineName,
    startedAt,
    endedAt,
    durationSeconds,
    exercises: draft.exercises
      .map((exercise) => ({
        id: exercise.id,
        name: exercise.name.trim(),
        sets: exercise.sets.map((set, index) => ({
          ...set,
          setNumber: index + 1,
          weight: set.weight === null ? null : Number(set.weight),
          reps: set.reps === null ? null : Number(set.reps),
        })),
      }))
      .filter((exercise) => exercise.name && exercise.sets.length),
    cardio: draft.cardio,
  }
}

const createTrainingExercise = (exercise: RoutineDraftExercise | Routine['exercises'][number]): TrainingExercise => ({
  id: createId('training-exercise'),
  name: exercise.name,
  sets: Array.from({ length: Math.max(1, Number(exercise.sets)) }, (_, index) => ({
    id: createId('training-set'),
    setNumber: index + 1,
    weight: null,
    reps: null,
    completed: false,
  })),
})

const emptyCardio = (): CardioSession => ({
  incline: null,
  speed: null,
  durationMinutes: null,
  completed: false,
})

const getPreviousExercise = (previousWorkout: Workout | undefined, exerciseName: string, exerciseIndex: number) => {
  const previousExerciseAtIndex = previousWorkout?.exercises[exerciseIndex]
  const normalizedExerciseName = normalizeName(exerciseName)

  if (previousExerciseAtIndex && normalizeName(previousExerciseAtIndex.name) === normalizedExerciseName) {
    return previousExerciseAtIndex
  }

  return previousWorkout?.exercises.find((exercise) => normalizeName(exercise.name) === normalizedExerciseName)
}

const fillSetFromPreviousWorkout = (
  set: TrainingExercise['sets'][number],
  exerciseName: string,
  exerciseIndex: number,
  previousWorkout: Workout | undefined,
) => {
  const previousSet = getPreviousExercise(previousWorkout, exerciseName, exerciseIndex)?.sets.find(
    (item) => item.setNumber === set.setNumber,
  )

  if (!previousSet) {
    return set
  }

  return {
    ...set,
    weight: set.weight === null ? previousSet.weight : set.weight,
    reps: set.reps === null ? previousSet.reps : set.reps,
  }
}

const hasCardioEntry = (cardio?: CardioSession) =>
  Boolean(cardio && (cardio.completed || cardio.incline !== null || cardio.speed !== null || cardio.durationMinutes !== null))

const formatCardioNumber = (value: number | null | undefined, suffix: string) =>
  value === null || value === undefined ? '--' : `${formatNumber(value)} ${suffix}`

const hasUserData = (value: AppState) =>
  Boolean(value.checkIns.length || value.routines.length || value.workouts.length || value.activeWorkout)

const vibrate = (pattern: number | number[] = 10) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function useSwipeAction({
  axis,
  onDelete,
  onEdit,
  threshold = 72,
}: {
  axis: 'x' | 'y'
  onDelete: () => void
  onEdit: () => void
  threshold?: number
}) {
  const startRef = useRef({ x: 0, y: 0, active: false, locked: false })
  const offsetRef = useRef(0)
  const suppressClickRef = useRef(false)
  const [offset, setOffset] = useState(0)

  const reset = () => {
    offsetRef.current = 0
    setOffset(0)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return
    }

    startRef.current = { x: event.clientX, y: event.clientY, active: true, locked: false }
    offsetRef.current = 0
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = startRef.current
    if (!start.active) {
      return
    }

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    const primary = axis === 'x' ? deltaX : deltaY
    const secondary = axis === 'x' ? deltaY : deltaX

    if (!start.locked && Math.abs(primary) < 10) {
      return
    }

    if (Math.abs(primary) <= Math.abs(secondary) * 1.15) {
      return
    }

    start.locked = true
    event.preventDefault()
    const nextOffset = clamp(primary, -96, 96)
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  const completeGesture = () => {
    const currentOffset = offsetRef.current
    const shouldDelete = currentOffset <= -threshold
    const shouldEdit = currentOffset >= threshold
    startRef.current = { ...startRef.current, active: false, locked: false }

    if (shouldDelete || shouldEdit) {
      suppressClickRef.current = true
      vibrate(18)
      if (shouldDelete) {
        onDelete()
      } else {
        onEdit()
      }
    }

    reset()
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    completeGesture()
  }

  const onPointerCancel = () => {
    startRef.current = { ...startRef.current, active: false, locked: false }
    reset()
  }

  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }

  return {
    className: offset ? 'dragging' : '',
    intent: Math.abs(offset) > 22 ? (offset < 0 ? 'delete' : 'edit') : undefined,
    style: offset
      ? ({
          transform: axis === 'x' ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`,
        } as CSSProperties)
      : undefined,
    handlers: {
      onClickCapture,
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  }
}

function App() {
  const [state, setState] = useState<AppState>(initialState)
  const stateRef = useRef(state)
  const authHydrationRef = useRef(0)
  const initialAuthHandledRef = useRef(false)
  const isHydratingRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [session, setSession] = useState<SyncSession | null>(null)
  const [syncEmail, setSyncEmail] = useState('')
  const [syncPassword, setSyncPassword] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [syncStatus, setSyncStatus] = useState<'local' | 'loading' | 'synced' | 'sent' | 'error'>('local')
  const [syncCooldown, setSyncCooldown] = useState(0)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => hasPasswordRecoveryParams())
  const [finishSummary, setFinishSummary] = useState<FinishSummary | null>(null)
  const [isFinishSummaryLeaving, setIsFinishSummaryLeaving] = useState(false)
  const [isWorkoutStarting, setIsWorkoutStarting] = useState(false)
  const [activeTab, setActiveTabState] = useState<TabKey>(() => tabFromHash())
  const [trainingPhraseIndex, setTrainingPhraseIndex] = useState(() => Math.floor(Math.random() * trainingPhrases.length))
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const storedTheme = localStorage.getItem('goy-theme')
    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme
    }
    return 'dark'
  })
  const [accent, setAccent] = useState<AccentColor>(() => {
    const storedAccent = localStorage.getItem('goy-accent')
    return accentOptions.some((option) => option.key === storedAccent) ? (storedAccent as AccentColor) : 'green'
  })
  const [isAccentMenuOpen, setIsAccentMenuOpen] = useState(false)
  const [selectedRoutineId, setSelectedRoutineId] = useState(initialState.routines[0]?.id ?? '')
  const [trainingMode, setTrainingMode] = useState<RoutineMode>('home')
  const [editingRoutineId, setEditingRoutineId] = useState('')
  const [selectedHistoryId, setSelectedHistoryId] = useState('')
  const [editingWorkoutId, setEditingWorkoutId] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [isAddingCheckIn, setIsAddingCheckIn] = useState(false)
  const [editingCheckInId, setEditingCheckInId] = useState('')
  const [checkInDraft, setCheckInDraft] = useState({
    weight: initialState.checkIns.at(-1)?.weight ?? 80,
    photo: '',
  })
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft>(() => routineToDraft())
  const activeWorkoutId = state.activeWorkout?.id
  const trainingPhrase = trainingPhrases[trainingPhraseIndex]

  const applyLoadedState = useCallback((savedState: AppState) => {
    stateRef.current = savedState
    setState(savedState)
    setSelectedRoutineId(savedState.routines[0]?.id ?? '')
    setSelectedHistoryId('')

    const latestCheckIn = [...savedState.checkIns].sort((a, b) => b.date.localeCompare(a.date))[0]
    if (latestCheckIn) {
      setCheckInDraft((draft) => ({ ...draft, weight: latestCheckIn.weight }))
    }
  }, [])

  const loadRemoteStateWithRetry = useCallback(async (userId: string) => {
    try {
      return await loadRemoteState(userId)
    } catch (error) {
      await wait(500)
      try {
        return await loadRemoteState(userId)
      } catch {
        throw error
      }
    }
  }, [])

  const hydrateSessionState = useCallback(async (nextSession: SyncSession, localState: AppState) => {
    const token = authHydrationRef.current + 1
    authHydrationRef.current = token
    isHydratingRef.current = true
    setSyncStatus('loading')

    try {
      const remoteState = await loadRemoteStateWithRetry(nextSession.user.id)
      if (authHydrationRef.current !== token) {
        return
      }

      const shouldBootstrapRemote = !hasUserData(remoteState) && hasUserData(localState)
      const nextState = shouldBootstrapRemote ? localState : remoteState

      applyLoadedState(nextState)
      setSession(nextSession)
      setSyncStatus('synced')
      setSyncMessage('')
      try {
        await saveLocalState(nextState)
      } catch (error) {
        console.error('Could not cache remote state locally', error)
      }

      if (shouldBootstrapRemote) {
        await saveRemoteState(nextSession.user.id, nextState)
      }
    } finally {
      if (authHydrationRef.current === token) {
        isHydratingRef.current = false
      }
    }

  }, [applyLoadedState, loadRemoteStateWithRetry])

  useEffect(() => {
    let mounted = true

    const loadInitialState = async () => {
      try {
        const localState = await loadLocalState()

        if (isSupabaseConfigured) {
          const currentSession = await getSession()
          if (!mounted) {
            return
          }

          if (currentSession && hasPasswordRecoveryParams()) {
            setSession(currentSession)
            setIsPasswordRecovery(true)
            setSyncPassword('')
            setSyncStatus('local')
            setSyncMessage('Escribe tu nueva contraseña.')
          } else if (currentSession) {
            await hydrateSessionState(currentSession, localState)
          } else {
            setSession(null)
            applyLoadedState(localState)
            setSyncStatus('local')
          }
        } else {
          applyLoadedState(localState)
          setSyncStatus('local')
        }
      } catch (error) {
        console.error('Could not load persisted state', error)
        if (mounted) {
          const fallbackState = await loadLocalState()
          applyLoadedState(fallbackState)
          setSyncStatus('error')
          setSyncMessage('No se pudo cargar Supabase.')
        }
      } finally {
        if (mounted) {
          initialAuthHandledRef.current = true
          setIsLoaded(true)
        }
      }
    }

    loadInitialState()

    const unsubscribe = onAuthChange(async (nextSession, event) => {
      if (!initialAuthHandledRef.current) {
        return
      }

      if (!nextSession) {
        authHydrationRef.current += 1
        isHydratingRef.current = false
        setSession(null)
        setSyncStatus('local')
        setIsPasswordRecovery(false)
        return
      }

      try {
        const localState = stateRef.current
        if (!mounted) {
          return
        }
        if (event === 'PASSWORD_RECOVERY') {
          setSession(nextSession)
          setIsPasswordRecovery(true)
          setSyncPassword('')
          setSyncStatus('local')
          setSyncMessage('Escribe tu nueva contraseña.')
          return
        }
        await hydrateSessionState(nextSession, localState)
        setSyncPassword('')
      } catch (error) {
        console.error('Could not load remote state', error)
        setSession(nextSession)
        setSyncStatus('error')
        setSyncMessage('No se pudo sincronizar.')
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [applyLoadedState, hydrateSessionState])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('goy-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
    localStorage.setItem('goy-accent', accent)
  }, [accent])

  useEffect(() => {
    const syncHash = () => setActiveTabState(tabFromHash())
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  useEffect(() => {
    if (!isLoaded || isHydratingRef.current) {
      return
    }

    const timeout = window.setTimeout(() => {
      const persist = async () => {
        try {
          await saveLocalState(state)
          if (session) {
            await saveRemoteState(session.user.id, state)
            setSyncStatus('synced')
          } else {
            setSyncStatus('local')
          }
        } catch (error) {
          console.error('Could not save state', error)
          setSyncStatus('error')
          setSyncMessage('No se pudo guardar.')
        }
      }

      persist()
    }, 220)

    return () => window.clearTimeout(timeout)
  }, [isLoaded, session, state])

  useEffect(() => {
    if (!activeWorkoutId) {
      return
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [activeWorkoutId])

  useEffect(() => {
    if (syncCooldown <= 0) {
      return
    }

    const interval = window.setInterval(() => setSyncCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [syncCooldown])

  useEffect(() => {
    if (!isWorkoutStarting) {
      return
    }

    const timeout = window.setTimeout(() => setIsWorkoutStarting(false), 900)
    return () => window.clearTimeout(timeout)
  }, [isWorkoutStarting])

  useEffect(() => {
    if (!finishSummary) {
      return
    }

    const leaveTimeout = window.setTimeout(() => setIsFinishSummaryLeaving(true), 4600)
    const removeTimeout = window.setTimeout(() => {
      setFinishSummary(null)
      setIsFinishSummaryLeaving(false)
    }, 5000)

    return () => {
      window.clearTimeout(leaveTimeout)
      window.clearTimeout(removeTimeout)
    }
  }, [finishSummary])

  useEffect(() => {
    if (activeTab !== 'training' || trainingMode !== 'home' || activeWorkoutId) {
      return
    }

    const interval = window.setInterval(() => {
      setTrainingPhraseIndex((index) => (index + 1) % trainingPhrases.length)
    }, 5200)

    return () => window.clearInterval(interval)
  }, [activeTab, activeWorkoutId, trainingMode])

  const sortedCheckIns = useMemo(
    () => [...state.checkIns].sort((a, b) => a.date.localeCompare(b.date)),
    [state.checkIns],
  )
  const sortedWorkouts = useMemo(
    () =>
      [...state.workouts].sort(
        (a, b) => getWorkoutStartDate(b).localeCompare(getWorkoutStartDate(a)) || b.startedAt.localeCompare(a.startedAt),
      ),
    [state.workouts],
  )
  const selectedRoutine = state.routines.find((routine) => routine.id === selectedRoutineId) ?? state.routines[0]
  const selectedHistoryWorkout = sortedWorkouts.find((workout) => workout.id === selectedHistoryId)
  const elapsedSeconds = state.activeWorkout
    ? Math.floor((now - new Date(state.activeWorkout.startedAt).getTime()) / 1000)
    : 0
  const activeRoutineId = state.activeWorkout?.routineId
  const activeRoutineName = state.activeWorkout?.routineName
  const previousWorkoutForActive = useMemo(() => {
    if (!activeRoutineName) {
      return undefined
    }

    const normalizedRoutineName = normalizeName(activeRoutineName)
    return sortedWorkouts.find(
      (workout) => workout.routineId === activeRoutineId || normalizeName(workout.routineName) === normalizedRoutineName,
    )
  }, [activeRoutineId, activeRoutineName, sortedWorkouts])
  const isTrainingFocus = activeTab === 'training' && Boolean(state.activeWorkout || trainingMode !== 'home')
  const mainClassName = ['main', `main-${activeTab}`, isTrainingFocus ? 'main-focus' : ''].filter(Boolean).join(' ')
  const currentAccent = accentOptions.find((option) => option.key === accent) ?? accentOptions[0]

  const setActiveTab = (tab: TabKey) => {
    if (tab !== activeTab) {
      vibrate(8)
    }
    setActiveTabState(tab)
    window.history.replaceState(null, '', `#${tab}`)
  }

  const resetRoutineDraft = () => {
    setRoutineDraft(routineToDraft())
    setEditingRoutineId('')
  }

  const createRoutine = () => {
    vibrate(10)
    setEditingRoutineId('')
    setRoutineDraft(routineToDraft())
    setTrainingMode('create')
  }

  const editSelectedRoutine = () => {
    if (!selectedRoutine) {
      return
    }

    vibrate(10)
    setEditingRoutineId(selectedRoutine.id)
    setRoutineDraft(routineToDraft(selectedRoutine))
    setTrainingMode('edit')
  }

  const requestSyncLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (syncCooldown > 0) {
      return
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const intent = submitter?.value ?? 'signin'

    if (intent === 'reset') {
      if (!syncEmail.trim()) {
        setSyncStatus('error')
        setSyncMessage('Escribe el correo de tu cuenta.')
        return
      }

      try {
        setSyncStatus('loading')
        await requestPasswordReset(syncEmail.trim())
        setSyncStatus('sent')
        setSyncCooldown(60)
        setSyncMessage('Si el correo existe, recibiras un link para recuperar tu contraseña.')
      } catch (error) {
        console.error('Could not request password reset', error)
        setSyncStatus('error')
        const errorMessage = error instanceof Error ? error.message : 'No se pudo enviar el correo.'
        setSyncMessage(errorMessage.toLowerCase().includes('rate limit') ? 'Espera 60 segundos antes de intentar otra vez.' : errorMessage)
        if (errorMessage.toLowerCase().includes('rate limit')) {
          setSyncCooldown(60)
        }
      }
      return
    }

    if (intent === 'password') {
      if (!syncPassword || syncPassword.length < 6) {
        setSyncStatus('error')
        setSyncMessage('La contraseña debe tener al menos 6 caracteres.')
        return
      }

      try {
        setSyncStatus('loading')
        await updatePassword(syncPassword)
        const currentSession = await getSession()
        if (currentSession) {
          await hydrateSessionState(currentSession, stateRef.current)
        }
        setIsPasswordRecovery(false)
        setSyncPassword('')
        setSyncStatus('synced')
        setSyncMessage('Contraseña actualizada.')
        clearPasswordRecoveryUrl()
      } catch (error) {
        console.error('Could not update password', error)
        setSyncStatus('error')
        setSyncMessage(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.')
      }
      return
    }

    if (!syncEmail.trim() || !syncPassword) {
      setSyncStatus('error')
      setSyncMessage('Escribe correo y contraseña.')
      return
    }

    const authIntent = intent === 'signup' ? 'signup' : 'signin'

    try {
      setSyncStatus('loading')
      if (authIntent === 'signup') {
        await signUpWithEmail(syncEmail.trim(), syncPassword)
      } else {
        await signInWithEmail(syncEmail.trim(), syncPassword)
      }
      setSyncStatus('sent')
      setSyncMessage(authIntent === 'signup' ? 'Cuenta creada.' : '')
    } catch (error) {
      console.error('Could not authenticate with Supabase', error)
      setSyncStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'No se pudo sincronizar.'

      if (errorMessage.toLowerCase().includes('rate limit')) {
        setSyncCooldown(60)
        setSyncMessage('Espera 60 segundos antes de intentar otra vez.')
        return
      }

      if (errorMessage.toLowerCase().includes('invalid login credentials')) {
        setSyncMessage('Correo o contraseña incorrectos.')
        return
      }

      if (errorMessage.toLowerCase().includes('already registered')) {
        setSyncMessage('Ese correo ya tiene cuenta. Usa Entrar.')
        return
      }

      setSyncMessage(errorMessage.replace('Signup', 'Registro'))
    }
  }

  const disconnectSync = async () => {
    authHydrationRef.current += 1
    isHydratingRef.current = false
    await signOut()
    setSession(null)
    setSyncStatus('local')
    setSyncPassword('')
  }

  const addCheckIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const entry: CheckIn = {
      id: createId('checkin'),
      date: todayIso(),
      weight: Number(checkInDraft.weight),
      photo: checkInDraft.photo || undefined,
    }

    setState((current) => ({
      ...current,
      checkIns: [entry, ...current.checkIns.filter((checkIn) => checkIn.date !== entry.date)],
    }))
    setCheckInDraft((draft) => ({ ...draft, photo: '' }))
    setIsAddingCheckIn(false)
    vibrate(18)
  }

  const updateCheckIn = (entry: CheckIn) => {
    setState((current) => ({
      ...current,
      checkIns: [entry, ...current.checkIns.filter((checkIn) => checkIn.id !== entry.id && checkIn.date !== entry.date)],
    }))
    setEditingCheckInId('')
    vibrate(18)
  }

  const deleteCheckIn = (id: string) => {
    if (!window.confirm('Eliminar esta entrada del timeline?')) {
      return
    }

    setState((current) => ({
      ...current,
      checkIns: current.checkIns.filter((checkIn) => checkIn.id !== id),
    }))
    setEditingCheckInId('')
    vibrate([12, 24, 12])
  }

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const photo = await readPhotoAsDataUrl(file)
    setCheckInDraft((draft) => ({ ...draft, photo }))
  }

  const saveRoutine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const exercises = routineDraft.exercises
      .map((exercise) => ({
        id: exercise.id.startsWith('draft-exercise') ? createId('routine-exercise') : exercise.id,
        name: exercise.name.trim(),
        sets: Math.max(1, Number(exercise.sets)),
      }))
      .filter((exercise) => exercise.name)

    if (!routineDraft.name.trim() || !exercises.length) {
      return
    }

    const routine: Routine = {
      id: trainingMode === 'edit' && editingRoutineId ? editingRoutineId : createId('routine'),
      name: routineDraft.name.trim(),
      days: routineDraft.days
        .split(',')
        .map((day) => day.trim())
        .filter(Boolean),
      exercises,
    }

    setState((current) => ({
      ...current,
      routines:
        trainingMode === 'edit'
          ? current.routines.map((item) => (item.id === routine.id ? routine : item))
          : [routine, ...current.routines],
    }))
    setSelectedRoutineId(routine.id)
    resetRoutineDraft()
    setTrainingMode('home')
    vibrate(18)
  }

  const deleteSelectedRoutine = () => {
    if (!selectedRoutine || !window.confirm(`Eliminar ${selectedRoutine.name}?`)) {
      return
    }

    const nextRoutines = state.routines.filter((routine) => routine.id !== selectedRoutine.id)

    setState((current) => ({
      ...current,
      routines: current.routines.filter((routine) => routine.id !== selectedRoutine.id),
    }))
    setSelectedRoutineId(nextRoutines[0]?.id ?? '')
    resetRoutineDraft()
    setTrainingMode('home')
    vibrate([12, 24, 12])
  }

  const updateWorkout = (workout: Workout) => {
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((item) => (item.id === workout.id ? workout : item)),
    }))
    setEditingWorkoutId('')
    setSelectedHistoryId(workout.id)
    vibrate(18)
  }

  const deleteWorkout = (id: string) => {
    if (!window.confirm('Eliminar este entrenamiento del historial?')) {
      return
    }

    setState((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== id),
    }))
    setSelectedHistoryId('')
    setEditingWorkoutId('')
    vibrate([12, 24, 12])
  }

  const startWorkout = () => {
    if (!selectedRoutine || state.activeWorkout) {
      return
    }

    const startedAt = new Date().toISOString()
    const workout: ActiveWorkout = {
      id: createId('active-workout'),
      date: todayIso(),
      routineId: selectedRoutine.id,
      routineName: selectedRoutine.name,
      startedAt,
      exercises: selectedRoutine.exercises.map(createTrainingExercise),
      cardio: emptyCardio(),
    }

    setNow(Date.now())
    setFinishSummary(null)
    setIsWorkoutStarting(true)
    setTrainingMode('home')
    setState((current) => ({ ...current, activeWorkout: workout }))
    vibrate(20)
  }

  const updateTrainingSet = (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps' | 'completed',
    value: number | boolean | null,
  ) => {
    setState((current) => {
      if (!current.activeWorkout) {
        return current
      }

      return {
        ...current,
        activeWorkout: {
          ...current.activeWorkout,
          exercises: current.activeWorkout.exercises.map((exercise, exerciseIndex) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  sets: exercise.sets.map((set) => {
                    if (set.id !== setId) {
                      return set
                    }

                    const updatedSet = {
                      ...set,
                      weight: field === 'weight' ? (value as number | null) : set.weight,
                      reps: field === 'reps' ? (value as number | null) : set.reps,
                      completed: field === 'completed' ? Boolean(value) : set.completed,
                    }

                    return field === 'completed' && value === true
                      ? fillSetFromPreviousWorkout(updatedSet, exercise.name, exerciseIndex, previousWorkoutForActive)
                      : updatedSet
                  }),
                }
              : exercise,
          ),
        },
      }
    })
  }

  const updateCardio = (field: keyof CardioSession, value: number | boolean | null) => {
    setState((current) => {
      if (!current.activeWorkout) {
        return current
      }

      return {
        ...current,
        activeWorkout: {
          ...current.activeWorkout,
          cardio: {
            ...(current.activeWorkout.cardio ?? emptyCardio()),
            [field]: value,
          },
        },
      }
    })
  }

  const finishWorkout = () => {
    if (!state.activeWorkout) {
      return
    }

    const endedAt = new Date().toISOString()
    const exercises = state.activeWorkout.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      sets: exercise.sets.map((set) =>
        set.completed ? fillSetFromPreviousWorkout(set, exercise.name, exerciseIndex, previousWorkoutForActive) : set,
      ),
    }))
    const workout: Workout = {
      ...state.activeWorkout,
      exercises,
      cardio: state.activeWorkout.cardio ?? emptyCardio(),
      endedAt,
      durationSeconds: Math.max(
        1,
        Math.floor((new Date(endedAt).getTime() - new Date(state.activeWorkout.startedAt).getTime()) / 1000),
      ),
    }

    const workouts = [workout, ...state.workouts]
    const streak = getFlexibleTrainingStreak(workouts, getWorkoutStartDate(workout))
    const message = completionMessages[Math.floor(Math.random() * completionMessages.length)]

    setIsFinishSummaryLeaving(false)
    setFinishSummary({ id: workout.id, message, streak })
    setState((current) => ({
      ...current,
      activeWorkout: undefined,
      workouts,
    }))
    setIsWorkoutStarting(false)
    setSelectedHistoryId(workout.id)
    setActiveTab('history')
    vibrate([18, 30, 22])
  }

  return (
    <div className={isTrainingFocus ? 'app-shell training-focus' : 'app-shell'}>
      <header className="app-header">
        <button className="brand" aria-label="Ir a Training" type="button" onClick={() => setActiveTab('training')}>
          <span className="brand-mark">
            <img alt="" src={brandMarkSrc} />
          </span>
          <span>The Goy Project</span>
        </button>

        <div className="header-actions">
          {session && (
            <button
              aria-label="Cuenta registrada. Tocar para salir"
              className={syncStatus === 'error' ? 'account-status error' : 'account-status'}
              data-tooltip={syncStatus === 'error' ? 'Error de sync' : 'Registrado'}
              type="button"
              onClick={() => {
                vibrate(10)
                void disconnectSync()
              }}
            >
              {syncStatus === 'error' ? <Cloud size={17} /> : <CheckCircle2 size={17} />}
            </button>
          )}
          <div className="accent-picker">
            <button
              aria-expanded={isAccentMenuOpen}
              aria-label="Elegir color de acento"
              className="icon-button accent-button"
              data-tooltip={currentAccent.label}
              type="button"
              onClick={() => {
                vibrate(8)
                setIsAccentMenuOpen((current) => !current)
              }}
            >
              <Palette size={17} />
              <span className="accent-dot" style={{ '--accent-dot': currentAccent.color } as CSSProperties} />
            </button>
            {isAccentMenuOpen && (
              <div className="accent-menu" role="menu">
                {accentOptions.map((option) => (
                  <button
                    aria-checked={option.key === accent}
                    aria-label={`Color ${option.label}`}
                    className={option.key === accent ? 'accent-swatch active' : 'accent-swatch'}
                    key={option.key}
                    role="menuitemradio"
                    style={{ '--accent-dot': option.color } as CSSProperties}
                    type="button"
                    onClick={() => {
                      vibrate(10)
                      setAccent(option.key)
                      setIsAccentMenuOpen(false)
                    }}
                  >
                    <span />
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="icon-button"
            data-tooltip={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            type="button"
            onClick={() => {
              vibrate(8)
              setIsAccentMenuOpen(false)
              setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Secciones">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              aria-current={item.key === activeTab ? 'page' : undefined}
              className={item.key === activeTab ? 'tab active' : 'tab'}
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <main className={mainClassName}>
        <SyncPanel
          email={syncEmail}
          isConfigured={isSupabaseConfigured}
          isPasswordRecovery={isPasswordRecovery}
          message={syncMessage}
          password={syncPassword}
          session={session}
          setEmail={setSyncEmail}
          setPassword={setSyncPassword}
          status={syncStatus}
          submit={requestSyncLink}
          syncCooldown={syncCooldown}
        />

        {finishSummary && (
          <CompletionBanner
            isLeaving={isFinishSummaryLeaving}
            summary={finishSummary}
            onDismiss={() => {
              setIsFinishSummaryLeaving(true)
              window.setTimeout(() => {
                setFinishSummary(null)
                setIsFinishSummaryLeaving(false)
              }, 360)
            }}
          />
        )}

        {activeTab === 'training' && (
          <TrainingView
            activeWorkout={state.activeWorkout}
            createRoutine={createRoutine}
            deleteSelectedRoutine={deleteSelectedRoutine}
            editSelectedRoutine={editSelectedRoutine}
            elapsedSeconds={elapsedSeconds}
            finishWorkout={finishWorkout}
            mode={trainingMode}
            previousWorkout={previousWorkoutForActive}
            resetRoutineDraft={resetRoutineDraft}
            routineDraft={routineDraft}
            routines={state.routines}
            saveRoutine={saveRoutine}
            selectedRoutine={selectedRoutine}
            selectedRoutineId={selectedRoutineId}
            isWorkoutStarting={isWorkoutStarting}
            trainingPhrase={trainingPhrase}
            setMode={setTrainingMode}
            setRoutineDraft={setRoutineDraft}
            setSelectedRoutineId={setSelectedRoutineId}
            startWorkout={startWorkout}
            updateCardio={updateCardio}
            updateTrainingSet={updateTrainingSet}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            deleteWorkout={deleteWorkout}
            editingWorkoutId={editingWorkoutId}
            selectedWorkout={selectedHistoryWorkout}
            setEditingWorkoutId={setEditingWorkoutId}
            setSelectedWorkoutId={setSelectedHistoryId}
            updateWorkout={updateWorkout}
            workouts={sortedWorkouts}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            checkInDraft={checkInDraft}
            checkIns={sortedCheckIns}
            deleteCheckIn={deleteCheckIn}
            editingCheckInId={editingCheckInId}
            handlePhotoUpload={handlePhotoUpload}
            isAdding={isAddingCheckIn}
            onSubmit={addCheckIn}
            setEditingCheckInId={setEditingCheckInId}
            setCheckInDraft={setCheckInDraft}
            setIsAdding={setIsAddingCheckIn}
            updateCheckIn={updateCheckIn}
          />
        )}

      </main>
    </div>
  )
}

function TrainingView({
  activeWorkout,
  createRoutine,
  deleteSelectedRoutine,
  editSelectedRoutine,
  elapsedSeconds,
  finishWorkout,
  isWorkoutStarting,
  mode,
  previousWorkout,
  resetRoutineDraft,
  routineDraft,
  routines,
  saveRoutine,
  selectedRoutine,
  selectedRoutineId,
  trainingPhrase,
  setMode,
  setRoutineDraft,
  setSelectedRoutineId,
  startWorkout,
  updateCardio,
  updateTrainingSet,
}: {
  activeWorkout?: ActiveWorkout
  createRoutine: () => void
  deleteSelectedRoutine: () => void
  editSelectedRoutine: () => void
  elapsedSeconds: number
  finishWorkout: () => void
  isWorkoutStarting: boolean
  mode: RoutineMode
  previousWorkout?: Workout
  resetRoutineDraft: () => void
  routineDraft: RoutineDraft
  routines: Routine[]
  saveRoutine: (event: FormEvent<HTMLFormElement>) => void
  selectedRoutine?: Routine
  selectedRoutineId: string
  trainingPhrase: string
  setMode: Dispatch<SetStateAction<RoutineMode>>
  setRoutineDraft: Dispatch<SetStateAction<RoutineDraft>>
  setSelectedRoutineId: Dispatch<SetStateAction<string>>
  startWorkout: () => void
  updateCardio: (field: keyof CardioSession, value: number | boolean | null) => void
  updateTrainingSet: (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps' | 'completed',
    value: number | boolean | null,
  ) => void
}) {
  const previousExercisesByName = useMemo(() => {
    const lookup = new Map<string, Workout['exercises'][number]>()
    previousWorkout?.exercises.forEach((exercise) => {
      lookup.set(normalizeName(exercise.name), exercise)
    })
    return lookup
  }, [previousWorkout])

  if (activeWorkout) {
    const totalSets = activeWorkout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    const completedSets = activeWorkout.exercises.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
      0,
    )
    const progressPercent = totalSets ? Math.round((completedSets / totalSets) * 100) : 0

    return (
      <section className={isWorkoutStarting ? 'focus-shell enter workout-start' : 'focus-shell enter'}>
        <div className="workout-head surface">
          <div>
            <span>{activeWorkout.routineName}</span>
            <strong>
              <Timer size={18} />
              {formatDuration(elapsedSeconds)}
            </strong>
            <small>
              {completedSets}/{totalSets} series
            </small>
          </div>
          <button className="finish-button" type="button" onClick={finishWorkout}>
            Terminar
          </button>
          <div
            aria-label={`Progreso ${progressPercent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressPercent}
            className="workout-progress"
            role="progressbar"
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="exercise-session">
          {activeWorkout.exercises.map((exercise, index) => {
            const normalizedExerciseName = normalizeName(exercise.name)
            const previousExerciseAtIndex = previousWorkout?.exercises[index]
            const previousExercise =
              previousExerciseAtIndex && normalizeName(previousExerciseAtIndex.name) === normalizedExerciseName
                ? previousExerciseAtIndex
                : previousExercisesByName.get(normalizedExerciseName)

            return (
              <article className="exercise-block" key={exercise.id}>
                <div className="exercise-title">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h2>{exercise.name}</h2>
                </div>
                <div className="set-table">
                  {exercise.sets.map((set) => {
                    const previousSet = previousExercise?.sets.find((item) => item.setNumber === set.setNumber)
                    const weightPlaceholder =
                      previousSet?.weight === null || previousSet?.weight === undefined ? 'kg' : formatNumber(previousSet.weight)
                    const repsPlaceholder = previousSet?.reps === null || previousSet?.reps === undefined ? 'reps' : String(previousSet.reps)

                    return (
                      <div className={set.completed ? 'set-line complete' : 'set-line'} key={set.id}>
                        <button
                          aria-label={set.completed ? 'Marcar serie pendiente' : 'Completar serie'}
                          className="complete-toggle"
                          data-tooltip="Completar"
                          type="button"
                          onClick={() => {
                            vibrate(8)
                            updateTrainingSet(exercise.id, set.id, 'completed', !set.completed)
                          }}
                        >
                          {set.completed ? <CheckCircle2 size={18} /> : <Check size={18} />}
                        </button>
                        <strong>{set.setNumber}</strong>
                        <input
                          {...numericInputProps}
                          aria-label="Peso"
                          inputMode="decimal"
                          min="0"
                          placeholder={weightPlaceholder}
                          step="0.5"
                          type="number"
                          value={set.weight ?? ''}
                          onChange={(event) =>
                            updateTrainingSet(
                              exercise.id,
                              set.id,
                              'weight',
                              event.target.value === '' ? null : Number(event.target.value),
                            )
                          }
                        />
                        <input
                          {...numericInputProps}
                          aria-label="Reps"
                          inputMode="numeric"
                          min="0"
                          placeholder={repsPlaceholder}
                          type="number"
                          value={set.reps ?? ''}
                          onChange={(event) =>
                            updateTrainingSet(
                              exercise.id,
                              set.id,
                              'reps',
                              event.target.value === '' ? null : Number(event.target.value),
                            )
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}

          <article className={activeWorkout.cardio.completed ? 'cardio-block complete' : 'cardio-block'}>
            <div className="exercise-title">
              <span>
                <Activity size={16} />
              </span>
              <h2>Cardio</h2>
            </div>
            <div className="cardio-grid">
              <Field label="Inclinacion">
                <input
                  {...numericInputProps}
                  aria-label="Inclinacion"
                  inputMode="decimal"
                  min="0"
                  placeholder="%"
                  step="0.5"
                  type="number"
                  value={activeWorkout.cardio.incline ?? ''}
                  onChange={(event) =>
                    updateCardio('incline', event.target.value === '' ? null : Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Velocidad">
                <input
                  {...numericInputProps}
                  aria-label="Velocidad"
                  inputMode="decimal"
                  min="0"
                  placeholder="km/h"
                  step="0.1"
                  type="number"
                  value={activeWorkout.cardio.speed ?? ''}
                  onChange={(event) =>
                    updateCardio('speed', event.target.value === '' ? null : Number(event.target.value))
                  }
                />
              </Field>
              <Field label="Tiempo">
                <input
                  {...numericInputProps}
                  aria-label="Tiempo de cardio"
                  inputMode="numeric"
                  min="0"
                  placeholder="min"
                  step="1"
                  type="number"
                  value={activeWorkout.cardio.durationMinutes ?? ''}
                  onChange={(event) =>
                    updateCardio('durationMinutes', event.target.value === '' ? null : Number(event.target.value))
                  }
                />
              </Field>
            </div>
            <button
              className={activeWorkout.cardio.completed ? 'cardio-toggle complete' : 'cardio-toggle'}
              type="button"
              onClick={() => {
                vibrate(8)
                updateCardio('completed', !activeWorkout.cardio.completed)
              }}
            >
              {activeWorkout.cardio.completed ? <CheckCircle2 size={18} /> : <Check size={18} />}
              Cardio listo
            </button>
          </article>
        </div>
      </section>
    )
  }

  if (mode !== 'home') {
    const isEditing = mode === 'edit'

    return (
      <section className="routine-create enter">
        <form className="surface routine-form focused" onSubmit={saveRoutine}>
          <div className="focus-top">
            <button
              aria-label="Volver"
              className="icon-button flat"
              data-tooltip="Volver"
              type="button"
              onClick={() => {
                vibrate(8)
                resetRoutineDraft()
                setMode('home')
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <strong>{isEditing ? 'Editar rutina' : 'Nueva rutina'}</strong>
          </div>

          <Field label="Nombre">
            <input
              autoFocus
              required
              placeholder="Push, Pull, Legs..."
              value={routineDraft.name}
              onChange={(event) => setRoutineDraft((draft) => ({ ...draft, name: event.target.value }))}
            />
          </Field>
          <Field label="Dias">
            <input
              placeholder="Lunes, Jueves"
              value={routineDraft.days}
              onChange={(event) => setRoutineDraft((draft) => ({ ...draft, days: event.target.value }))}
            />
          </Field>

          <div className="routine-exercises">
            {routineDraft.exercises.map((exercise, index) => (
              <div className="routine-row" key={exercise.id}>
                <input
                  aria-label="Ejercicio"
                  placeholder={`Ejercicio ${index + 1}`}
                  value={exercise.name}
                  onChange={(event) =>
                    setRoutineDraft((draft) => ({
                      ...draft,
                      exercises: draft.exercises.map((row) =>
                        row.id === exercise.id ? { ...row, name: event.target.value } : row,
                      ),
                    }))
                  }
                />
                <input
                  {...numericInputProps}
                  aria-label="Series"
                  inputMode="numeric"
                  min="1"
                  type="number"
                  value={exercise.sets}
                  onChange={(event) =>
                    setRoutineDraft((draft) => ({
                      ...draft,
                      exercises: draft.exercises.map((row) =>
                        row.id === exercise.id ? { ...row, sets: Math.max(1, Number(event.target.value) || 1) } : row,
                      ),
                    }))
                  }
                />
                <div className="order-controls">
                  <button
                    aria-label="Subir ejercicio"
                    className="icon-button flat"
                    data-tooltip="Subir"
                    disabled={index === 0}
                    type="button"
                    onClick={() => {
                      vibrate(8)
                      setRoutineDraft((draft) => {
                        const exercises = [...draft.exercises]
                        const previous = exercises[index - 1]
                        if (!previous) {
                          return draft
                        }
                        ;[exercises[index - 1], exercises[index]] = [exercises[index], exercises[index - 1]]
                        return { ...draft, exercises }
                      })
                    }}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    aria-label="Bajar ejercicio"
                    className="icon-button flat"
                    data-tooltip="Bajar"
                    disabled={index === routineDraft.exercises.length - 1}
                    type="button"
                    onClick={() => {
                      vibrate(8)
                      setRoutineDraft((draft) => {
                        const exercises = [...draft.exercises]
                        const next = exercises[index + 1]
                        if (!next) {
                          return draft
                        }
                        ;[exercises[index], exercises[index + 1]] = [exercises[index + 1], exercises[index]]
                        return { ...draft, exercises }
                      })
                    }}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
                <button
                  aria-label="Eliminar ejercicio"
                  className="icon-button flat"
                  data-tooltip="Eliminar"
                  disabled={routineDraft.exercises.length === 1}
                  type="button"
                  onClick={() => {
                    vibrate(8)
                    setRoutineDraft((draft) => ({
                      ...draft,
                      exercises: draft.exercises.filter((row) => row.id !== exercise.id),
                    }))
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="button-row">
            <button
              aria-label="Agregar ejercicio"
              className="secondary-button"
              data-tooltip="Agregar ejercicio"
              type="button"
              onClick={() => {
                vibrate(8)
                setRoutineDraft((draft) => ({
                  ...draft,
                  exercises: [...draft.exercises, createRoutineExercise()],
                }))
              }}
            >
              <Plus size={17} />
            </button>
            <button className="primary-button compact" type="submit">
              <Save size={17} />
              Guardar
            </button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <section className="training-home enter">
      <h1 className="training-phrase" key={trainingPhrase}>
        {trainingPhrase}
      </h1>
      <div className="surface start-card">
        {routines.length ? (
          <>
            <div className="routine-picker">
              <select value={selectedRoutineId} onChange={(event) => setSelectedRoutineId(event.target.value)}>
                {routines.map((routine) => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name}
                  </option>
                ))}
              </select>
              <button
                aria-label="Nueva rutina"
                className="icon-button"
                data-tooltip="Nueva rutina"
                type="button"
                onClick={createRoutine}
              >
                <Plus size={19} />
              </button>
              <button
                aria-label="Editar rutina"
                className="icon-button"
                data-tooltip="Editar rutina"
                disabled={!selectedRoutine}
                type="button"
                onClick={editSelectedRoutine}
              >
                <Pencil size={18} />
              </button>
              <button
                aria-label="Eliminar rutina"
                className="icon-button danger"
                data-tooltip="Eliminar rutina"
                disabled={!selectedRoutine}
                type="button"
                onClick={deleteSelectedRoutine}
              >
                <Trash2 size={18} />
              </button>
            </div>

            <button className="primary-button start-button" disabled={!selectedRoutine} type="button" onClick={startWorkout}>
              <Play size={20} />
              Iniciar
            </button>
          </>
        ) : (
          <button
            className="first-routine-button"
            type="button"
            onClick={createRoutine}
          >
            <Plus size={20} />
            Crear rutina
          </button>
        )}
      </div>
    </section>
  )
}

function CompletionBanner({
  isLeaving,
  onDismiss,
  summary,
}: {
  isLeaving: boolean
  onDismiss: () => void
  summary: FinishSummary
}) {
  const fireLevel = getFireLevel(summary.streak)

  return (
    <section className={isLeaving ? 'completion-banner leaving' : 'completion-banner enter'} key={summary.id}>
      <div className={`streak-flame level-${fireLevel}`} aria-hidden="true">
        <Flame size={23} />
      </div>
      <div>
        <strong>{summary.message}</strong>
        <span>
          Racha de {summary.streak} {summary.streak === 1 ? 'dia' : 'dias'}
        </span>
      </div>
      <button aria-label="Cerrar mensaje" className="icon-button flat" type="button" onClick={onDismiss}>
        <X size={17} />
      </button>
    </section>
  )
}

function SyncPanel({
  email,
  isConfigured,
  isPasswordRecovery,
  message,
  password,
  session,
  setEmail,
  setPassword,
  status,
  submit,
  syncCooldown,
}: {
  email: string
  isConfigured: boolean
  isPasswordRecovery: boolean
  message: string
  password: string
  session: SyncSession | null
  setEmail: Dispatch<SetStateAction<string>>
  setPassword: Dispatch<SetStateAction<string>>
  status: 'local' | 'loading' | 'synced' | 'sent' | 'error'
  submit: (event: FormEvent<HTMLFormElement>) => void
  syncCooldown: number
}) {
  if (!isConfigured) {
    return (
      <section className="sync-panel muted">
        <Cloud size={17} />
        <span>Supabase pendiente</span>
      </section>
    )
  }

  if (session && !isPasswordRecovery) {
    return null
  }

  if (isPasswordRecovery) {
    return (
      <form className="sync-panel login password-recovery" onSubmit={submit}>
        <KeyRound size={17} />
        <input
          aria-label="Nueva contraseña"
          autoComplete="new-password"
          minLength={6}
          placeholder="nueva contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="primary-button compact" disabled={status === 'loading'} type="submit" value="password">
          Guardar
        </button>
        {message && <small>{message}</small>}
      </form>
    )
  }

  return (
    <form className="sync-panel login" onSubmit={submit}>
      <Mail size={17} />
      <input
        aria-label="Email"
        autoComplete="email"
        placeholder="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        aria-label="Contraseña"
        autoComplete="current-password"
        minLength={6}
        placeholder="contraseña"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="primary-button compact" disabled={status === 'loading' || syncCooldown > 0} type="submit" value="signin">
        {syncCooldown > 0 ? `${syncCooldown}s` : 'Entrar'}
      </button>
      <button className="secondary-button compact" disabled={status === 'loading' || syncCooldown > 0} type="submit" value="signup">
        Crear
      </button>
      <button className="ghost-button compact" disabled={status === 'loading' || syncCooldown > 0} type="submit" value="reset">
        Recuperar
      </button>
      {message && <small>{message}</small>}
    </form>
  )
}

function HistoryView({
  deleteWorkout,
  editingWorkoutId,
  selectedWorkout,
  setEditingWorkoutId,
  setSelectedWorkoutId,
  updateWorkout,
  workouts,
}: {
  deleteWorkout: (id: string) => void
  editingWorkoutId: string
  selectedWorkout?: Workout
  setEditingWorkoutId: Dispatch<SetStateAction<string>>
  setSelectedWorkoutId: Dispatch<SetStateAction<string>>
  updateWorkout: (workout: Workout) => void
  workouts: Workout[]
}) {
  const focusedWorkout = selectedWorkout ?? workouts[0]
  const focusedWorkoutDate = focusedWorkout ? getWorkoutStartDate(focusedWorkout) : todayIso()
  const latestWorkoutMonth = focusedWorkoutDate.slice(0, 7)
  const [visibleMonth, setVisibleMonth] = useState(latestWorkoutMonth)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(focusedWorkoutDate)
  const [expandedWorkoutId, setExpandedWorkoutId] = useState('')
  const calendarWasNavigatedRef = useRef(false)
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth, workouts), [visibleMonth, workouts])
  const monthWorkouts = useMemo(
    () => workouts.filter((workout) => getWorkoutStartDate(workout).startsWith(visibleMonth)),
    [visibleMonth, workouts],
  )
  const effectiveSelectedDate = selectedCalendarDate.startsWith(visibleMonth)
    ? selectedCalendarDate
    : monthWorkouts[0] ? getWorkoutStartDate(monthWorkouts[0]) : `${visibleMonth}-01`
  const selectedDayWorkouts = useMemo(
    () => workouts.filter((workout) => getWorkoutStartDate(workout) === effectiveSelectedDate),
    [effectiveSelectedDate, workouts],
  )

  useEffect(() => {
    if (!workouts.length || calendarWasNavigatedRef.current) {
      return
    }

    setVisibleMonth(latestWorkoutMonth)
    setSelectedCalendarDate(focusedWorkoutDate)
  }, [focusedWorkoutDate, latestWorkoutMonth, workouts.length])

  const changeCalendarMonth = (offset: number) => {
    vibrate(8)
    calendarWasNavigatedRef.current = true
    const nextMonth = addMonths(visibleMonth, offset)
    const nextWorkout = workouts.find((workout) => getWorkoutStartDate(workout).startsWith(nextMonth))
    setVisibleMonth(nextMonth)
    setSelectedCalendarDate(nextWorkout ? getWorkoutStartDate(nextWorkout) : `${nextMonth}-01`)
    setExpandedWorkoutId('')
    setEditingWorkoutId('')
    setSelectedWorkoutId('')
  }

  return (
    <section className={workouts.length ? 'history-feed enter' : 'history-feed history-empty enter'}>
      <HistoryCalendar
        days={calendarDays}
        monthLabel={formatMonthKey(visibleMonth)}
        onChangeMonth={changeCalendarMonth}
        onSelectDate={setSelectedCalendarDate}
        deleteWorkout={deleteWorkout}
        editingWorkoutId={editingWorkoutId}
        expandedWorkoutId={expandedWorkoutId}
        selectedDate={effectiveSelectedDate}
        selectedWorkouts={selectedDayWorkouts}
        setEditingWorkoutId={setEditingWorkoutId}
        setExpandedWorkoutId={setExpandedWorkoutId}
        setSelectedWorkoutId={setSelectedWorkoutId}
        updateWorkout={updateWorkout}
      />
    </section>
  )
}

function HistoryCalendar({
  deleteWorkout,
  days,
  editingWorkoutId,
  expandedWorkoutId,
  monthLabel,
  onChangeMonth,
  onSelectDate,
  selectedDate,
  selectedWorkouts,
  setEditingWorkoutId,
  setExpandedWorkoutId,
  setSelectedWorkoutId,
  updateWorkout,
}: {
  deleteWorkout: (id: string) => void
  days: CalendarDay[]
  editingWorkoutId: string
  expandedWorkoutId: string
  monthLabel: string
  onChangeMonth: (offset: number) => void
  onSelectDate: (date: string) => void
  selectedDate: string
  selectedWorkouts: Workout[]
  setEditingWorkoutId: Dispatch<SetStateAction<string>>
  setExpandedWorkoutId: Dispatch<SetStateAction<string>>
  setSelectedWorkoutId: Dispatch<SetStateAction<string>>
  updateWorkout: (workout: Workout) => void
}) {
  const selectedDateLabel = formatDate(selectedDate)

  return (
    <section className="surface history-calendar">
      <div className="calendar-head">
        <button aria-label="Mes anterior" className="icon-button flat" type="button" onClick={() => onChangeMonth(-1)}>
          <ChevronLeft size={18} />
        </button>
        <strong>{monthLabel}</strong>
        <button aria-label="Mes siguiente" className="icon-button flat" type="button" onClick={() => onChangeMonth(1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map((day) => {
          const hasWorkout = day.workouts.length > 0
          const isSelected = day.date === selectedDate
          const className = [
            'calendar-day',
            day.isCurrentMonth ? '' : 'muted',
            hasWorkout ? 'trained' : '',
            isSelected ? 'selected' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              aria-label={`${formatDate(day.date)}${hasWorkout ? `, ${day.workouts.length} entrenamiento` : ', sin entrenamiento'}`}
              className={className}
              key={day.date}
              type="button"
              onClick={() => {
                vibrate(hasWorkout ? 10 : 4)
                onSelectDate(day.date)
                setEditingWorkoutId('')
                setExpandedWorkoutId('')
                setSelectedWorkoutId('')
              }}
            >
              <span>{day.dayNumber}</span>
            </button>
          )
        })}
      </div>

      <div className="calendar-summary">
        <span>{selectedDateLabel}</span>
        {selectedWorkouts.length ? (
          <div className="calendar-workouts">
            {selectedWorkouts.map((workout) => (
              <article className={expandedWorkoutId === workout.id ? 'calendar-workout expanded' : 'calendar-workout'} key={workout.id}>
                <button
                  type="button"
                  onClick={() => {
                    vibrate(8)
                    const willExpand = expandedWorkoutId !== workout.id
                    setEditingWorkoutId('')
                    setExpandedWorkoutId(willExpand ? workout.id : '')
                    setSelectedWorkoutId(willExpand ? workout.id : '')
                  }}
                >
                  <strong>{workout.routineName}</strong>
                  <small>{formatDuration(workout.durationSeconds)}</small>
                </button>

                {expandedWorkoutId === workout.id &&
                  (editingWorkoutId === workout.id ? (
                    <WorkoutEditor key={workout.id} onCancel={() => setEditingWorkoutId('')} onSave={updateWorkout} workout={workout} />
                  ) : (
                    <WorkoutDetail
                      onDelete={() => deleteWorkout(workout.id)}
                      onEdit={() => {
                        vibrate(10)
                        setExpandedWorkoutId(workout.id)
                        setSelectedWorkoutId(workout.id)
                        setEditingWorkoutId(workout.id)
                      }}
                      workout={workout}
                    />
                  ))}
              </article>
            ))}
          </div>
        ) : (
          <strong>Sin entrenamiento</strong>
        )}
      </div>
    </section>
  )
}

function WorkoutDetail({
  onDelete,
  onEdit,
  workout,
}: {
  onDelete: () => void
  onEdit: () => void
  workout: Workout
}) {
  return (
    <section className="history-expanded">
      <div className="history-actions">
        <button className="secondary-button compact" type="button" onClick={onEdit}>
          <Pencil size={16} />
          Editar
        </button>
        <button className="secondary-button compact danger-text" type="button" onClick={onDelete}>
          <Trash2 size={16} />
          Eliminar
        </button>
      </div>
      <div className="detail-exercises">
        {workout.exercises.map((exercise) => (
          <article className="detail-exercise" key={exercise.id}>
            <h3>{exercise.name}</h3>
            <div className="detail-sets">
              {exercise.sets.map((set) => (
                <span key={set.id}>
                  {set.setNumber}. {set.weight === null ? '--' : formatNumber(set.weight)} kg · {set.reps ?? '--'} reps
                </span>
              ))}
            </div>
          </article>
        ))}

        {hasCardioEntry(workout.cardio) && (
          <article className="detail-exercise detail-cardio">
            <h3>
              <Activity size={17} />
              Cardio
            </h3>
            <div className="cardio-stats">
              <span>{formatCardioNumber(workout.cardio.incline, '%')} incl.</span>
              <span>{formatCardioNumber(workout.cardio.speed, 'km/h')}</span>
              <span>{formatCardioNumber(workout.cardio.durationMinutes, 'min')}</span>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}

function WorkoutEditor({
  onCancel,
  onSave,
  workout,
}: {
  onCancel: () => void
  onSave: (workout: Workout) => void
  workout: Workout
}) {
  const [draft, setDraft] = useState<WorkoutDraft>(() => workoutToDraft(workout))

  const updateExercise = (exerciseId: string, patch: Partial<WorkoutDraftExercise>) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    }))
  }

  const updateSet = (exerciseId: string, setId: string, patch: Partial<WorkoutDraftSet>) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
            }
          : exercise,
      ),
    }))
  }

  const removeSet = (exerciseId: string, setId: string) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets:
                exercise.sets.length > 1
                  ? exercise.sets.filter((set) => set.id !== setId).map((set, index) => ({ ...set, setNumber: index + 1 }))
                  : exercise.sets,
            }
          : exercise,
      ),
    }))
  }

  const addSet = (exerciseId: string) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, createWorkoutDraftSet(exercise.sets.length + 1)],
            }
          : exercise,
      ),
    }))
  }

  const removeExercise = (exerciseId: string) => {
    setDraft((current) => ({
      ...current,
      exercises:
        current.exercises.length > 1 ? current.exercises.filter((exercise) => exercise.id !== exerciseId) : current.exercises,
    }))
  }

  const addExercise = () => {
    setDraft((current) => ({
      ...current,
      exercises: [...current.exercises, createWorkoutDraftExercise()],
    }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(draftToWorkout(workout, draft))
  }

  return (
    <form className="history-expanded workout-editor" onSubmit={submit}>
      <div className="editor-grid">
        <Field label="Fecha">
          <input
            required
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
          />
        </Field>
        <Field label="Rutina">
          <input
            required
            value={draft.routineName}
            onChange={(event) => setDraft((current) => ({ ...current, routineName: event.target.value }))}
          />
        </Field>
        <Field label="Duracion min">
          <input
            {...numericInputProps}
            inputMode="numeric"
            min="1"
            required
            type="number"
            value={draft.durationMinutes}
            onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: Math.max(1, Number(event.target.value) || 1) }))}
          />
        </Field>
      </div>

      <div className="editor-exercises">
        {draft.exercises.map((exercise, exerciseIndex) => (
          <article className="editor-exercise" key={exercise.id}>
            <div className="editor-head">
              <input
                aria-label="Ejercicio"
                placeholder={`Ejercicio ${exerciseIndex + 1}`}
                required
                value={exercise.name}
                onChange={(event) => updateExercise(exercise.id, { name: event.target.value })}
              />
              <button
                aria-label="Eliminar ejercicio"
                className="icon-button flat danger-text"
                data-tooltip="Eliminar ejercicio"
                disabled={draft.exercises.length === 1}
                type="button"
                onClick={() => {
                  vibrate(8)
                  removeExercise(exercise.id)
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="editor-sets">
              {exercise.sets.map((set) => (
                <div className={set.completed ? 'editor-set complete' : 'editor-set'} key={set.id}>
                  <button
                    aria-label={set.completed ? 'Marcar pendiente' : 'Completar serie'}
                    className="complete-toggle"
                    type="button"
                    onClick={() => {
                      vibrate(8)
                      updateSet(exercise.id, set.id, { completed: !set.completed })
                    }}
                  >
                    {set.completed ? <CheckCircle2 size={16} /> : <Check size={16} />}
                  </button>
                  <strong>{set.setNumber}</strong>
                  <input
                    {...numericInputProps}
                    aria-label="Peso"
                    inputMode="decimal"
                    min="0"
                    placeholder="kg"
                    step="0.5"
                    type="number"
                    value={set.weight ?? ''}
                    onChange={(event) => updateSet(exercise.id, set.id, { weight: event.target.value === '' ? null : Number(event.target.value) })}
                  />
                  <input
                    {...numericInputProps}
                    aria-label="Reps"
                    inputMode="numeric"
                    min="0"
                    placeholder="reps"
                    type="number"
                    value={set.reps ?? ''}
                    onChange={(event) => updateSet(exercise.id, set.id, { reps: event.target.value === '' ? null : Number(event.target.value) })}
                  />
                  <button
                    aria-label="Eliminar serie"
                    className="icon-button flat danger-text"
                    disabled={exercise.sets.length === 1}
                    type="button"
                    onClick={() => {
                      vibrate(8)
                      removeSet(exercise.id, set.id)
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button className="secondary-button compact add-set-button" type="button" onClick={() => addSet(exercise.id)}>
              <Plus size={16} />
              Serie
            </button>
          </article>
        ))}
      </div>

      <button className="secondary-button compact" type="button" onClick={addExercise}>
        <Plus size={16} />
        Ejercicio
      </button>

      <section className="editor-cardio">
        <div className="cardio-grid">
          <Field label="Inclinacion">
            <input
              {...numericInputProps}
              inputMode="decimal"
              min="0"
              step="0.5"
              type="number"
              value={draft.cardio.incline ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  cardio: { ...current.cardio, incline: event.target.value === '' ? null : Number(event.target.value) },
                }))
              }
            />
          </Field>
          <Field label="Velocidad">
            <input
              {...numericInputProps}
              inputMode="decimal"
              min="0"
              step="0.1"
              type="number"
              value={draft.cardio.speed ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  cardio: { ...current.cardio, speed: event.target.value === '' ? null : Number(event.target.value) },
                }))
              }
            />
          </Field>
          <Field label="Tiempo">
            <input
              {...numericInputProps}
              inputMode="numeric"
              min="0"
              step="1"
              type="number"
              value={draft.cardio.durationMinutes ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  cardio: { ...current.cardio, durationMinutes: event.target.value === '' ? null : Number(event.target.value) },
                }))
              }
            />
          </Field>
        </div>
        <button
          className={draft.cardio.completed ? 'cardio-toggle complete' : 'cardio-toggle'}
          type="button"
          onClick={() => setDraft((current) => ({ ...current, cardio: { ...current.cardio, completed: !current.cardio.completed } }))}
        >
          {draft.cardio.completed ? <CheckCircle2 size={18} /> : <Check size={18} />}
          Cardio listo
        </button>
      </section>

      <div className="editor-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-button compact" type="submit">
          <Save size={17} />
          Guardar
        </button>
      </div>
    </form>
  )
}

function TimelineView({
  checkInDraft,
  checkIns,
  deleteCheckIn,
  editingCheckInId,
  handlePhotoUpload,
  isAdding,
  onSubmit,
  setEditingCheckInId,
  setCheckInDraft,
  setIsAdding,
  updateCheckIn,
}: {
  checkInDraft: { weight: number; photo: string }
  checkIns: CheckIn[]
  deleteCheckIn: (id: string) => void
  editingCheckInId: string
  handlePhotoUpload: (event: ChangeEvent<HTMLInputElement>) => void
  isAdding: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  setEditingCheckInId: Dispatch<SetStateAction<string>>
  setCheckInDraft: Dispatch<SetStateAction<{ weight: number; photo: string }>>
  setIsAdding: Dispatch<SetStateAction<boolean>>
  updateCheckIn: (entry: CheckIn) => void
}) {
  return (
    <section className="timeline-horizontal enter">
      <div className="timeline-track">
        {checkIns.map((checkIn) => (
          <TimelineCheckInItem
            checkIn={checkIn}
            deleteCheckIn={deleteCheckIn}
            editingCheckInId={editingCheckInId}
            key={checkIn.id}
            setEditingCheckInId={setEditingCheckInId}
            setIsAdding={setIsAdding}
            updateCheckIn={updateCheckIn}
          />
        ))}

        <article className="timeline-item add-item">
          <div className="timeline-dot add" />
          {isAdding ? (
            <form className="surface add-checkin" onSubmit={onSubmit}>
              <label className="mini-photo-drop" data-tooltip="Foto">
                {checkInDraft.photo ? <img alt="Foto seleccionada" src={checkInDraft.photo} /> : <Camera size={26} />}
                <input accept="image/*" hidden type="file" onChange={handlePhotoUpload} />
              </label>
              <Field label="Peso">
                <input
                  {...numericInputProps}
                  autoFocus
                  inputMode="decimal"
                  min="0"
                  required
                  step="0.1"
                  type="number"
                  value={checkInDraft.weight}
                  onChange={(event) => setCheckInDraft((draft) => ({ ...draft, weight: Number(event.target.value) }))}
                />
              </Field>
              <div className="button-row">
                <button
                  aria-label="Cancelar"
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    vibrate(8)
                    setIsAdding(false)
                  }}
                >
                  <ArrowLeft size={17} />
                </button>
                <button className="primary-button compact" type="submit">
                  <Save size={17} />
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <button
              aria-label="Agregar foto y peso"
              className="add-photo-button"
              type="button"
              onClick={() => {
                vibrate(10)
                setEditingCheckInId('')
                setIsAdding(true)
              }}
            >
              <Plus size={26} />
            </button>
          )}
          <time>{isAdding ? formatShortDate(todayIso()) : 'Nuevo'}</time>
        </article>
      </div>
    </section>
  )
}

function TimelineCheckInItem({
  checkIn,
  deleteCheckIn,
  editingCheckInId,
  setEditingCheckInId,
  setIsAdding,
  updateCheckIn,
}: {
  checkIn: CheckIn
  deleteCheckIn: (id: string) => void
  editingCheckInId: string
  setEditingCheckInId: Dispatch<SetStateAction<string>>
  setIsAdding: Dispatch<SetStateAction<boolean>>
  updateCheckIn: (entry: CheckIn) => void
}) {
  const isEditing = editingCheckInId === checkIn.id
  const openEditor = () => {
    vibrate(10)
    setIsAdding(false)
    setEditingCheckInId(checkIn.id)
  }
  const swipe = useSwipeAction({
    axis: 'y',
    onDelete: () => deleteCheckIn(checkIn.id),
    onEdit: openEditor,
  })

  return (
    <article className="timeline-item">
      <div className="timeline-dot" />
      {isEditing ? (
        <CheckInEditor key={checkIn.id} checkIn={checkIn} onCancel={() => setEditingCheckInId('')} onSave={updateCheckIn} />
      ) : (
        <>
          <div
            className={['vertical-photo-card timeline-swipe-card', swipe.className].filter(Boolean).join(' ')}
            data-swipe={swipe.intent}
            style={swipe.style}
            {...swipe.handlers}
          >
            <div className="timeline-actions">
              <button
                aria-label="Editar entrada"
                className="icon-button glass"
                data-tooltip="Editar"
                type="button"
                onClick={openEditor}
              >
                <Pencil size={15} />
              </button>
              <button
                aria-label="Eliminar entrada"
                className="icon-button glass danger-text"
                data-tooltip="Eliminar"
                type="button"
                onClick={() => deleteCheckIn(checkIn.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
            {checkIn.photo ? <img alt={`Foto ${formatDate(checkIn.date)}`} src={checkIn.photo} /> : <Camera size={32} />}
            <strong>{formatNumber(checkIn.weight)} kg</strong>
          </div>
          <time>{formatShortDate(checkIn.date)}</time>
        </>
      )}
    </article>
  )
}

function CheckInEditor({
  checkIn,
  onCancel,
  onSave,
}: {
  checkIn: CheckIn
  onCancel: () => void
  onSave: (entry: CheckIn) => void
}) {
  const [draft, setDraft] = useState<CheckInDraft>(() => ({
    date: checkIn.date,
    weight: checkIn.weight,
    photo: checkIn.photo ?? '',
  }))

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const photo = await readPhotoAsDataUrl(file)
    setDraft((current) => ({ ...current, photo }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave({
      id: checkIn.id,
      date: draft.date,
      weight: Number(draft.weight),
      photo: draft.photo || undefined,
    })
  }

  return (
    <form className="surface add-checkin timeline-edit-form" onSubmit={submit}>
      <label className="mini-photo-drop" data-tooltip="Foto">
        {draft.photo ? <img alt="Foto seleccionada" src={draft.photo} /> : <Camera size={26} />}
        <input accept="image/*" hidden type="file" onChange={uploadPhoto} />
      </label>
      <Field label="Fecha">
        <input
          required
          type="date"
          value={draft.date}
          onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
        />
      </Field>
      <Field label="Peso">
        <input
          {...numericInputProps}
          inputMode="decimal"
          min="0"
          required
          step="0.1"
          type="number"
          value={draft.weight}
          onChange={(event) => setDraft((current) => ({ ...current, weight: Number(event.target.value) }))}
        />
      </Field>
      <div className="button-row">
        <button aria-label="Cancelar" className="secondary-button" type="button" onClick={onCancel}>
          <ArrowLeft size={17} />
        </button>
        <button className="primary-button compact" type="submit">
          <Save size={17} />
          Guardar
        </button>
      </div>
    </form>
  )
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function buildCalendarDays(monthKey: string, workouts: Workout[]): CalendarDay[] {
  const [year, month] = monthKey.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const workoutsByDate = new Map<string, Workout[]>()

  workouts.forEach((workout) => {
    const startDate = getWorkoutStartDate(workout)
    workoutsByDate.set(startDate, [...(workoutsByDate.get(startDate) ?? []), workout])
  })

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month - 1, index - startOffset + 1)
    const dateKey = toDateKey(date)

    return {
      date: dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1,
      workouts: workoutsByDate.get(dateKey) ?? [],
    }
  })
}

export default App
