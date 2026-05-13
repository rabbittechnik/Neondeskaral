import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/auth-context'
import { router } from './routes/router'
import './styles/globals.css'

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Registrieren, sobald die App idle ist (besseres First Paint).
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore */
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
