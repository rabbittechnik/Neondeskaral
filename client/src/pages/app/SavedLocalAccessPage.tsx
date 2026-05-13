import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminToken, clearAdminToken } from '../../services/api'
import {
  clearStoredEmployeeAccessSession,
  getStoredEmployeeAccessToken,
} from '../employee-app/employeeAppStorage'
import { clearStationTabletToken, readStationTabletToken } from '../../utils/stationTabletToken'
import { Button } from '../../components/ui/Button'

/**
 * Nur localStorage/sessionStorage auf diesem Gerät — keine Server-Tokens löschen.
 */
export function SavedLocalAccessPage() {
  const [, bump] = useState(0)
  const refresh = () => bump((x) => x + 1)

  useLayoutEffect(() => {
    refresh()
  }, [])

  const hasAdmin = Boolean(getAdminToken())
  const hasEmployee = Boolean(getStoredEmployeeAccessToken())
  const hasTablet = Boolean(readStationTabletToken())

  const clearEmployee = () => {
    clearStoredEmployeeAccessSession()
    refresh()
  }
  const clearTablet = () => {
    clearStationTabletToken()
    refresh()
  }
  const clearAdmin = () => {
    clearAdminToken()
    refresh()
  }
  const clearAll = () => {
    clearStoredEmployeeAccessSession()
    clearStationTabletToken()
    clearAdminToken()
    refresh()
  }

  return (
    <div className="flex min-h-dvh flex-col items-center bg-[#070b12] px-5 py-10 text-slate-200">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Rabbit-Technik</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Gespeicherte Zugänge verwalten</h1>
          <p className="mt-2 text-sm text-slate-400">
            Hier werden nur die lokalen Anmeldedaten auf <strong className="text-slate-300">diesem Gerät</strong>{' '}
            gelöscht. Server, Mitarbeiter-QR und Stations-Tablets bleiben unverändert — bei Bedarf erneut scannen oder
            anmelden.
          </p>
        </div>

        <ul className="space-y-4 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm">
          <li className="flex flex-col gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-white">Admin-App (Benutzername/Passwort)</p>
              <p className="text-slate-500">{hasAdmin ? 'Vorhanden' : 'Nicht vorhanden'}</p>
            </div>
            {hasAdmin ? (
              <Button type="button" variant="outline" className="shrink-0 text-xs" onClick={clearAdmin}>
                Admin-Login löschen
              </Button>
            ) : null}
          </li>
          <li className="flex flex-col gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-white">Mitarbeiter-App (persönlicher QR)</p>
              <p className="text-slate-500">{hasEmployee ? 'Vorhanden' : 'Nicht vorhanden'}</p>
            </div>
            {hasEmployee ? (
              <Button type="button" variant="outline" className="shrink-0 text-xs" onClick={clearEmployee}>
                Mitarbeiter-Zugang löschen
              </Button>
            ) : null}
          </li>
          <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-white">Stations-Tablet (Stations-QR)</p>
              <p className="text-slate-500">{hasTablet ? 'Vorhanden' : 'Nicht vorhanden'}</p>
            </div>
            {hasTablet ? (
              <Button type="button" variant="outline" className="shrink-0 text-xs" onClick={clearTablet}>
                Tablet-Zugang löschen
              </Button>
            ) : null}
          </li>
        </ul>

        <div className="flex flex-col gap-3">
          <Button type="button" variant="primary" className="w-full" onClick={clearAll}>
            Alle lokalen Zugänge löschen
          </Button>
          <Link
            to="/app"
            className="text-center text-sm text-cyan-300/90 underline-offset-4 hover:underline"
          >
            Zurück zur App-Auswahl
          </Link>
          <Link to="/" className="text-center text-sm text-slate-500 underline-offset-4 hover:underline">
            Zur Startauswahl
          </Link>
        </div>
      </div>
    </div>
  )
}
