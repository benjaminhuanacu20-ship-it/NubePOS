import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import './index.css'

const root = document.getElementById('root')

if (!root) {
  document.body.innerHTML =
    '<p style="font-family:system-ui;padding:2rem">No se encontró #root en index.html</p>'
} else {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
