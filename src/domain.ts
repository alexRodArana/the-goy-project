import type { Workout } from './types'

export type CalendarDay = {
  date: string
  dayNumber: number | null
  isCurrentMonth: boolean
  workouts: Workout[]
}

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const todayIso = () => toDateKey(new Date())

export const toLocalDate = (value: string) => new Date(`${value}T12:00:00`)

export const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export const getWorkoutStartDate = (workout: Workout) => {
  const startedAt = new Date(workout.startedAt)
  return Number.isNaN(startedAt.getTime()) ? workout.date : toDateKey(startedAt)
}

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(toLocalDate(value))

export const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--:--'
  }

  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  }).format(date)
}

export const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(toLocalDate(value))

export const formatMonth = (value: string) => {
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(toLocalDate(value))
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)

export const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const rest = safeSeconds % 60

  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':')
}

export const normalizeName = (value: string) => value.trim().toLocaleLowerCase('es-MX')

export const addMonths = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return toMonthKey(date)
}

export const formatMonthKey = (monthKey: string) => formatMonth(`${monthKey}-01`)

export const dayDifference = (laterDate: string, earlierDate: string) =>
  Math.round((toLocalDate(laterDate).getTime() - toLocalDate(earlierDate).getTime()) / 86_400_000)

export const getFlexibleTrainingStreak = (workouts: Workout[], referenceDate = todayIso()) => {
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

export const getFireLevel = (streak: number) => (streak <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil(streak / 3))))

export function buildCalendarDays(monthKey: string, workouts: Workout[]): CalendarDay[] {
  const [year, month] = monthKey.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const workoutsByDate = new Map<string, Workout[]>()

  workouts.forEach((workout) => {
    const startDate = getWorkoutStartDate(workout)
    workoutsByDate.set(startDate, [...(workoutsByDate.get(startDate) ?? []), workout])
  })

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return {
        date: `${monthKey}-empty-${index}`,
        dayNumber: null,
        isCurrentMonth: false,
        workouts: [],
      }
    }

    const dateKey = `${monthKey}-${String(dayNumber).padStart(2, '0')}`

    return {
      date: dateKey,
      dayNumber,
      isCurrentMonth: true,
      workouts: workoutsByDate.get(dateKey) ?? [],
    }
  })
}
