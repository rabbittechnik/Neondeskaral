import { useLayoutEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Smartphone, Tablet } from 'lucide-react'
import { getAdminToken } from '../../services/api'
import { getStoredEmployeeAccessToken } from '../employee-app/employeeAppStorage'
import { readStationTabletToken } from '../../utils/stationTabletToken'
import { Button } from '../../components/ui/Button'

function readFlags() {
  return {
    admin: Boolean(getAdminToken()),
    employee: Boolean(getStoredEmployeeAccessToken()),
    tablet: Boolean(readStationTabletToken()),
  }
}

function countFlags(f: ReturnType<typeof readFlags>) {
  return Number(f.admin) + Number(f.employee) + Number(f.tablet)
}

/**
 * PWA-Startpunkt: entscheidet nur anhand gespeicherter Tokens (kein display-mode).
 * Mehrere Zugänge → Auswahl; genau einer → Weiterleitung; keiner → Startauswahl.
 */
export function AppHubPage() {
  const navigate = useNavigate()
  const [flags, setFlags] = useState(readFlags)

  useLayoutEffect(() => {
    setFlags(readFlags())
  }, [])

  const n = countFlags(flags)
  if (n === 0) {
    return <Navigate to="/" replace />
  }

  if (n === 1) {
    if (flags.admin) return <Navigate to="/dashboard" replace />
    if (flags.employee) return <Navigate to="/employee" replace />
    const tok = readStationTabletToken()
    if (tok) return <Navigate to={`/tablet/${encodeURIComponent(tok)}`} replace />
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#070b12] px-5 py-12 text-slate-200">
      <div className="w-full max-w-md rounded-2xl border border-cyan-500/20 bg-slate-900/85 p-8 shadow-[0_0_48px_rgba(34,211,238,0.12)]">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Rabbit-Technik</p>
        <h1 className="mt-3 text-center text-2xl font-bold text-white">Welche App möchtest du öffnen?</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Auf diesem Gerät sind mehrere gespeicherte Zugänge vorhanden. Bitte wähle — der Modus hängt nur vom Token,
          nicht von der Installation.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {flags.admin ? (
            <Button
              type="button"
              variant="primary"
              className="w-full justify-center gap-2 py-3 text-base"
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard className="h-5 w-5" aria-hidden />
              Adminbereich öffnen
            </Button>
          ) : null}
          {flags.employee ? (
            <Button
              type="button"
              variant={flags.admin ? 'outline' : 'primary'}
              className="w-full justify-center gap-2 py-3 text-base"
              onClick={() => navigate('/employee')}
            >
              <Smartphone className="h-5 w-5" aria-hidden />
              Mitarbeiter-App öffnen
            </Button>
          ) : null}
          {flags.tablet ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2 py-3 text-base"
              onClick={() => {
                const tok = readStationTabletToken()
                if (tok) navigate(`/tablet/${encodeURIComponent(tok)}`)
              }}
            >
              <Tablet className="h-5 w-5" aria-hidden />
              Stations-Tablet öffnen
            </Button>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-6 text-center text-sm">
          <Link to="/app/zugaenge" className="font-medium text-cyan-300/95 underline-offset-4 hover:underline">
            Gespeicherte Zugänge verwalten
          </Link>
          <Link to="/" className="text-slate-500 underline-offset-4 hover:text-slate-400 hover:underline">
            Zur Startauswahl
          </Link>
        </div>
      </div>
    </div>
  )
}
