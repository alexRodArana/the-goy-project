import { Component } from 'react'
import type { ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="error-screen" role="alert">
        <h1>No se pudo abrir la app.</h1>
        <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
      </main>
    )
  }
}
