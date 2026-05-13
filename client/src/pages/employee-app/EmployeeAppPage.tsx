import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import {
  clearStoredEmployeeAccessSession,
  getStoredEmployeeAccessToken,
  setStoredEmployeeAccessSession,
} from './employeeAppStorage'
import { EmployeeAppHome } from './EmployeeAppHome'
import { parseAccessPasteInput } from '../../utils/accessPasteInput'
import { probeEmployeeAccessSession, probeTabletSession } from '../../utils/accessTokenProbe'

export function EmployeeAppPage() {
  const navigate = useNavigate()
  const [boot, setBoot] = useState(0)
  const token = useMemo(() => getStoredEmployeeAccessToken(), [boot])
  const [manual, setManual] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wrongTablet, setWrongTablet] = useState<{ token: string } | null>(null)

  const clearAll = () => {
    clearStoredEmployeeAccessSession()
    setBoot((x) => x + 1)
    setManual('')
    setErr(null)
    setWrongTablet(null)
  }

  const saveManual = async () => {
    setErr(null)
    setWrongTablet(null)
    const p = parseAccessPasteInput(manual)
    if (p.kind === 'invalid') {
      setErr(p.message)
      return
    }
    if (p.kind === 'tablet') {
      setWrongTablet({ token: p.token })
      return
    }
    setBusy(true)
    try {
      if (p.kind === 'employee') {
        const pr = await probeEmployeeAccessSession(p.token)
        if (pr.ok) {
          setStoredEmployeeAccessSession(p.token, pr.employee.displayName, pr.station.name)
          setBoot((x) => x + 1)
          setManual('')
        } else {
          setErr('Dieser Zugang ist ungültig oder wurde deaktiviert.')
        }
        return
      }
      const empFirst = await probeEmployeeAccessSession(p.token)
      if (empFirst.ok) {
        setStoredEmployeeAccessSession(p.token, empFirst.employee.displayName, empFirst.station.name)
        setBoot((x) => x + 1)
        setManual('')
        return
      }
      const tab = await probeTabletSession(p.token)
      if (tab) {
        setWrongTablet({ token: p.token })
        return
      }
      setErr('Dieser Zugang ist ungültig oder wurde deaktiviert.')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10 text-slate-200">
        <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/80 p-6 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Rabbit-Technik Station</p>
          <h1 className="mt-2 text-xl font-bold text-white">Mitarbeiter-App einrichten</h1>
          <p className="mt-3 text-sm text-slate-400">
            Kein Mitarbeiter-Zugang gespeichert. Bitte Mitarbeiter-QR-Code scannen oder den Link aus der Einladung
            einfügen.
          </p>

          {wrongTablet ? (
            <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-medium">Dieser QR-Code gehört zu einem Stations-Tablet, nicht zu einer Mitarbeiter-App.</p>
              <Button
                type="button"
                variant="primary"
                className="mt-3 w-full"
                onClick={() => navigate(`/tablet/${encodeURIComponent(wrongTablet.token)}`, { replace: true })}
              >
                Stations-Tablet öffnen
              </Button>
              <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => setWrongTablet(null)}>
                Zurück
              </Button>
            </div>
          ) : null}

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Mitarbeiter-Link oder Token
          </label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-cyan-500/30 focus:ring-2"
            rows={3}
            placeholder="https://…/employee/… oder /employee-access/… oder Token"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            disabled={busy}
          />
          {err ? <p className="mt-2 text-sm text-amber-300">{err}</p> : null}
          <Button
            type="button"
            variant="primary"
            className="mt-4 w-full"
            disabled={busy}
            onClick={() => void saveManual()}
          >
            {busy ? 'Prüfe…' : 'Zugang speichern'}
          </Button>
          <p className="mt-4 text-center text-xs text-slate-500">
            <Link to="/app/zugaenge" className="text-cyan-300/90 underline">
              Gespeicherte Zugänge verwalten
            </Link>
            {' · '}
            <Link to="/" className="text-cyan-300/90 underline">
              Zur Startseite
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return <EmployeeAppHome key={token} accessToken={token} onClearSession={clearAll} />
}
