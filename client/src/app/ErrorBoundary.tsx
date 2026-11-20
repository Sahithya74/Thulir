import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}

/** Last-resort boundary: a calm message instead of a blank screen if rendering throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Thulir render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-forest">Something went wrong.</h1>
          <button type="button" onClick={() => location.assign(import.meta.env.BASE_URL)} className="tap mt-5 border border-forest bg-forest px-5 text-cream">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
