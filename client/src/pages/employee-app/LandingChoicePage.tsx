import { Navigate, Link } from 'react-router-dom'
import { LayoutDashboard, Smartphone, Tablet } from 'lucide-react'
import { getAdminToken } from '../../services/api'
import { getStoredEmployeeAccessToken } from './employeeAppStorage'
import { readStationTabletToken } from '../../utils/stationTabletToken'

export function LandingChoicePage() {
  const admin = Boolean(getAdminToken())
  const emp = Boolean(getStoredEmployeeAccessToken())
  const tab = Boolean(readStationTabletToken())
  const n = Number(admin) + Number(emp) + Number(tab)

  if (n >= 2) {
    return <Navigate to="/app" replace />
  }
  if (admin) return <Navigate to="/dashboard" replace />
  if (emp) return <Navigate to="/employee" replace />
  if (tab) {
    const tok = readStationTabletToken()
    if (tok) return <Navigate to={`/tablet/${encodeURIComponent(tok)}`} replace />
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#070b12] px-5 py-12 text-slate-200">
      <div className="w-full max-w-md rounded-2xl border border-cyan-500/20 bg-slate-900/85 p-8 shadow-[0_0_48px_rgba(34,211,238,0.12)]">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Rabbit-Technik</p>
        <h1 className="mt-3 text-center text-2xl font-bold text-white">Wie möchtest du fortfahren?</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Wähle deinen Bereich – Mitarbeiter-App (Handy) und Stations-Tablet (Tankstelle) nutzen kein Admin-App-Login (Chef /
          Teamleitung).
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/login"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:bg-cyan-400"
          >
            <LayoutDashboard className="h-5 w-5" aria-hidden />
            Admin-App anmelden (Chef / Teamleitung)
          </Link>
          <Link
            to="/employee"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-transparent px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/10"
          >
            <Smartphone className="h-5 w-5" aria-hidden />
            Mitarbeiter-App einrichten
          </Link>
          <Link
            to="/tablet"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-transparent px-4 py-3 text-base font-semibold text-slate-100 transition hover:bg-white/5"
          >
            <Tablet className="h-5 w-5" aria-hidden />
            Stations-Tablet (QR von der Leitung)
          </Link>
          <p className="text-center text-[11px] text-slate-500">
            Ohne QR-Code: Stations-Tablet für Tests unter <span className="text-slate-400">/tablet/dev</span>
          </p>
        </div>

        <p className="mt-8 text-center text-sm">
          <Link to="/app/zugaenge" className="text-cyan-400/90 underline-offset-4 hover:underline">
            Gespeicherte Zugänge verwalten
          </Link>
        </p>
      </div>
    </div>
  )
}
