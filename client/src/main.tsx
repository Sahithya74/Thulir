import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './app/App'

async function start() {
  // Static GitHub Pages build: start the in-browser API before the app makes its first request.
  if (import.meta.env.VITE_STATIC_API === '1') {
    const { installStaticApi } = await import('virtual:thulir-static-api')
    await installStaticApi()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
void start()
