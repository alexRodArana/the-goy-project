import { Component } from 'react'
import type { ReactNode } from 'react'

const CACHE_PREFIX = 'the-goy-project-'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; recovering: boolean }> {
  state = { failed: false, recovering: false }
  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: unknown) {
    console.error('Application render failed', error)
  }

  recover = async () => {
    this.setState({ recovering: true })
    const appUrl = new URL(import.meta.env.BASE_URL, window.location.href)

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          registrations
            .filter((registration) => registration.scope === appUrl.href)
            .map((registration) => registration.unregister()),
        )
      }
      if ('caches' in window) {
        const keys = await window.caches.keys()
        await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => window.caches.delete(key)))
      }
    } catch (error) {
      console.error('Application shell recovery failed', error)
    }

    window.location.replace(appUrl.href)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="error-screen" role="alert">
        <h1>No se pudo abrir la app.</h1>
        <p>Tus entrenamientos siguen guardados. Actualiza la aplicación para volver a intentarlo.</p>
        <div>
          <button className="secondary" type="button" onClick={() => window.location.reload()}>Reintentar</button>
          <button disabled={this.state.recovering} type="button" onClick={() => { void this.recover() }}>
            {this.state.recovering ? 'Actualizando...' : 'Actualizar app'}
          </button>
        </div>
      </main>
    )
  }
}
