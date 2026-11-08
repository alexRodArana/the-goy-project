import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './ErrorBoundary'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((registration) => {
        let isChecking = false
        const checkForUpdate = async () => {
          if (isChecking || !navigator.onLine || document.visibilityState === 'hidden') return
          isChecking = true
          try {
            await registration.update()
          } catch (error) {
            console.error('Service worker update failed', error)
          } finally {
            isChecking = false
          }
        }

        window.addEventListener('online', () => { void checkForUpdate() })
        document.addEventListener('visibilitychange', () => { void checkForUpdate() })
      })
      .catch((error) => {
        console.error('Service worker registration failed', error)
      })
  })
}
