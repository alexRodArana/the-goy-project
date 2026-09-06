(() => {
  const root = document.documentElement
  let mode = 'system'
  let accent = 'green'
  try {
    const legacy = root.dataset.app === 'keep-slopping' ? 'keep-slopping' : 'goy'
    const saved = localStorage.getItem('goy-suite-theme-mode')
    if (saved === 'light' || saved === 'dark') mode = saved
    const savedAccent = localStorage.getItem('goy-suite-accent') || localStorage.getItem(`${legacy}-accent`)
    if (['green', 'blue', 'purple', 'orange', 'rose'].includes(savedAccent)) accent = savedAccent
  } catch { /* Follow the device even when storage is blocked. */ }
  const theme = mode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode
  root.dataset.theme = theme
  root.dataset.themeMode = mode
  root.dataset.accent = accent
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0f12' : '#f5f6f8')
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default')
})()
