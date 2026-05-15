import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'
import { StationProvider } from '../../context/station-context'

const SLOW_HINT_MS = 12_000

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, loading, authError, refreshMe } = useAuth()
  const loc = useLocation()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!loading) {
      setSlow(false)
      return
    }
    const id = window.setTimeout(() => setSlow(true), SLOW_HINT_MS)
    return () => window.clearTimeout(id)
  }, [loading])

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg-main)] px-6 text-center text-sm text-[var(--text-muted)]">
        <p>Wird geladen…</p>
        {slow ? (
          <p className="max-w-sm text-xs text-amber-200/90">
            Der Server antwortet langsam. Bitte warten oder in ein paar Sekunden erneut versuchen.
          </p>
        ) : null}
        {slow ? (
          <button
            type="button"
            className="rounded-[var(--radius-sm)] border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20"
            onClick={() => void refreshMe()}
          >
            Erneut versuchen
          </button>
        ) : null}
      </div>
    )
  }

  if (authError && !token) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg-main)] px-6 text-center">
        <p className="text-sm text-rose-300/95">{authError}</p>
        <button
          type="button"
          className="rounded-[var(--radius-sm)] border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20"
          onClick={() => void refreshMe()}
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  return <StationProvider>{children}</StationProvider>
}
