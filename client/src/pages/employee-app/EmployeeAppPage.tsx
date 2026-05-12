import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import {
  clearStoredEmployeeAccessSession,
  getStoredEmployeeAccessToken,
  parseEmployeeAccessTokenFromInput,
  setStoredEmployeeAccessSession,
} from './employeeAppStorage'
import { EmployeeAppHome } from './EmployeeAppHome'

export function EmployeeAppPage() {
  const [boot, setBoot] = useState(0)
  const token = useMemo(() => getStoredEmployeeAccessToken(), [boot])
  const [manual, setManual] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const clearAll = () => {
    clearStoredEmployeeAccessSession()
    setBoot((x) => x + 1)
    setManual('')
    setErr(null)
  }

  const saveManual = () => {
    setErr(null)
    const parsed = parseEmployeeAccessTokenFromInput(manual)
    if (!parsed) {
      setErr('Bitte einen gültigen Link oder Token einfügen.')
      return
    }
    setStoredEmployeeAccessSession(parsed, '', '')
    setBoot((x) => x + 1)
    setManual('')
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10 text-slate-200">
        <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/80 p-6 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
          <h1 className="text-xl font-bold text-white">Mitarbeiter-App einrichten</h1>
          <p className="mt-3 text-sm text-slate-400">
            Scanne deinen persönlichen QR-Code, um deine Mitarbeiter-App mit deinem Zugang zu verbinden.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Alternativ kannst du den Link aus der Einladungs-E-Mail oder den Token aus der Mitarbeiterverwaltung hier
            einfügen.
          </p>
          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Mitarbeiter-Link oder Token
          </label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-500/30 focus:ring-2"
            rows={3}
            placeholder="https://…/employee-access/… oder Token"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          {err ? <p className="mt-2 text-sm text-amber-300">{err}</p> : null}
          <Button type="button" variant="primary" className="mt-4 w-full" onClick={() => saveManual()}>
            Zugang speichern
          </Button>
          <p className="mt-4 text-center text-xs text-slate-500">
            <Link to="/" className="text-cyan-300/90 underline">
              Zur Startseite
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <EmployeeAppHome
      key={token}
      accessToken={token}
      onClearSession={clearAll}
    />
  )
}
