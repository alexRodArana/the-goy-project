import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from './types'

const { testState } = vi.hoisted(() => {
  const state: AppState = {
    activeWorkout: undefined,
    cardioEnabled: false,
    routineRotation: ['routine-1', 'routine-2'],
    routines: [
      {
        days: ['Lunes'],
        exercises: [
          {
            id: 'routine-exercise-1',
            name: 'Press banca',
            sets: 2,
          },
        ],
        id: 'routine-1',
        name: 'Push Kosher',
      },
      {
        days: ['Martes'],
        exercises: [
          {
            id: 'routine-exercise-2',
            name: 'Jalon al pecho',
            sets: 2,
          },
        ],
        id: 'routine-2',
        name: 'Pull Kosher',
      },
    ],
    workouts: [
      {
        cardio: {
          completed: false,
          durationMinutes: null,
          incline: null,
          speed: null,
        },
        date: '2026-07-09',
        durationSeconds: 2820,
        endedAt: '2026-07-10T14:17:00.000Z',
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
              {
                completed: false,
                id: 'set-2',
                reps: 8,
                setNumber: 2,
                weight: 82.5,
              },
            ],
          },
        ],
        id: 'workout-1',
        routineId: 'routine-1',
        routineName: 'Push Kosher',
        startedAt: '2026-07-10T13:30:00.000Z',
      },
    ],
  }

  return { testState: state }
})

vi.mock('./sampleData', () => ({
  initialState: testState,
}))

vi.mock('./storage', async (importOriginal) => ({
  ...await importOriginal<typeof import('./storage')>(),
  loadLocalState: vi.fn(async () => testState),
}))

vi.mock('./supabase', () => ({
  getSession: vi.fn(async () => null),
  isSupabaseConfigured: false,
  loadRemoteState: vi.fn(async () => testState),
  onAuthChange: vi.fn(() => () => undefined),
  requestPasswordReset: vi.fn(async () => undefined),
  saveRemoteState: vi.fn(async () => undefined),
  signInWithEmail: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  signUpWithEmail: vi.fn(async () => undefined),
  updatePassword: vi.fn(async () => undefined),
}))

describe('App training and history', () => {
  beforeEach(() => {
    window.location.hash = '#history'
    localStorage.setItem('goy-theme', 'dark')
  })

  it('keeps the selected day summary minimal and expands workout details on demand', async () => {
    const { default: App } = await import('./App')

    render(<App />)

    const workoutButton = await screen.findByRole('button', { name: 'Push Kosher' })

    expect(workoutButton).toHaveTextContent(/^Push Kosher$/)
    expect(screen.queryByText(/Duracion 00:47:00/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Inicio/i)).not.toBeInTheDocument()

    fireEvent.click(workoutButton)

    expect(await screen.findByText(/Duracion 00:47:00/i)).toBeInTheDocument()
    expect(screen.getByText(/Inicio .* Fin/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Editar entrenamiento')).toBeInTheDocument()
    expect(screen.getByLabelText('Eliminar entrenamiento')).toBeInTheDocument()

    fireEvent.click(workoutButton)

    await waitFor(() => {
      expect(screen.queryByText(/Duracion 00:47:00/i)).not.toBeInTheDocument()
    })
  })

  it('does not append cardio when it is disabled for the account', async () => {
    window.location.hash = '#training'
    const { default: App } = await import('./App')

    render(<App />)
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('routine-2'))
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar' }))

    expect(await screen.findByRole('heading', { name: 'Jalon al pecho' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cardio' })).not.toBeInTheDocument()
  })
})
