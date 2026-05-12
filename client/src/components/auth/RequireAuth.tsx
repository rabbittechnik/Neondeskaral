import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'

import { StationProvider } from '../../context/station-context'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-main)] text-sm text-[var(--text-muted)]">
        Wird geladen…
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  return <StationProvider>{children}</StationProvider>
}
