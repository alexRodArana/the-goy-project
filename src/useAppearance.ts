import { useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'rose'
export const accentOptions = [
  { key: 'green', label: 'Verde', color: '#55c995' },
  { key: 'blue', label: 'Azul', color: '#72a5ff' },
  { key: 'purple', label: 'Morado', color: '#af95f4' },
  { key: 'orange', label: 'Naranja', color: '#f1a956' },
  { key: 'rose', label: 'Rosa', color: '#f284ad' },
] as const

function read(key: string, legacy?: string) {
  try { return localStorage.getItem(`goy-suite-${key}`) ?? (legacy ? localStorage.getItem(`${legacy}-${key}`) : null) }
  catch { return null }
}

function parseMode(value: string | null): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function useAppearance(legacy: string) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => parseMode(read('theme-mode')))
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const theme = themeMode === 'system' ? (deviceDark ? 'dark' : 'light') : themeMode
  const [accent, setAccent] = useState<AccentColor>(() => {
    const value = read('accent', legacy)
    return accentOptions.find((option) => option.key === value)?.key ?? 'green'
  })

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const update = () => setDeviceDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.themeMode = themeMode
    root.dataset.accent = accent
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0f12' : '#f5f6f8')
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default')
    try {
      localStorage.setItem('goy-suite-theme-mode', themeMode)
      localStorage.setItem('goy-suite-accent', accent)
    } catch { /* Appearance remains usable when browser storage is unavailable. */ }
  }, [theme, themeMode, accent])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === 'goy-suite-theme-mode' || event.key === null) setThemeMode(parseMode(event.newValue))
      if (event.key === 'goy-suite-accent' || event.key === null) {
        setAccent(accentOptions.find((item) => item.key === event.newValue)?.key ?? 'green')
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  return { theme, themeMode, setThemeMode, accent, setAccent }
}
