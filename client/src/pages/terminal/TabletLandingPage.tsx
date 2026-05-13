import { useLayoutEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Tablet } from 'lucide-react'
import { readStationTabletToken } from '../../utils/stationTabletToken'

/** `/tablet` — nutzt gespeicherten Tablet-Token (PWA start_url) oder Hinweis zum QR-Scan. */
export function TabletLandingPage() {
  const [savedToken, setSavedToken] = useState<string | null | undefined>(undefined)

  useLayoutEffect(() => {
    setSavedToken(readStationTabletToken())
  }, [])

  if (savedToken === undefined) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#070b12] px-6 py-12 text-slate-400">
        <p className="text-sm">Laden…</p>
      </div>
    )
  }

  if (savedToken) {
    return <Navigate to={`/tablet/${encodeURIComponent(savedToken)}`} replace />
  }

  const showDevHint = import.meta.env.DEV

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#070b12] px-6 py-12 text-slate-100">
      <Tablet className="h-14 w-14 text-cyan-400/90" aria-hidden />
      <h1 className="mt-6 text-center text-xl font-semibold text-white">Kein Tablet-Zugang angegeben</h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-400">
        Bitte Stations-QR-Code scannen. Die Leitung erzeugt den Code unter „Mein Konto · Geräte & Apps“.
      </p>
      {showDevHint ? (
        <p className="mt-4 max-w-md text-center text-xs text-slate-500">
          Entwicklung: Terminal ohne Stations-QR unter{' '}
          <Link to="/tablet/dev" className="text-cyan-300 underline hover:text-cyan-200">
            /tablet/dev
          </Link>
          .
        </p>
      ) : null}
      <Link
        to="/"
        className="mt-10 text-sm font-medium text-cyan-400/90 underline-offset-4 hover:underline hover:text-cyan-300"
      >
        Zur Startauswahl
      </Link>
    </div>
  )
}
