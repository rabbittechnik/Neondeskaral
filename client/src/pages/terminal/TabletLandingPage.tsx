import { useCallback, useLayoutEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Tablet } from 'lucide-react'
import { TabletQrScannerModal } from '../../components/terminal/TabletQrScannerModal'
import { Button } from '../../components/ui/Button'
import { readStationTabletToken, writeStationTabletToken } from '../../utils/stationTabletToken'
import { validateTabletSession } from '../../utils/tabletQrToken'
import { parseAccessPasteInput } from '../../utils/accessPasteInput'
import { probeEmployeeAccessSession } from '../../utils/accessTokenProbe'

/** `/tablet` — gespeicherter Token, oder Einrichtung per QR / manueller Eingabe. */
export function TabletLandingPage() {
  const navigate = useNavigate()
  const [savedToken, setSavedToken] = useState<string | null | undefined>(undefined)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'connected'>('idle')
  const [wrongEmployee, setWrongEmployee] = useState<{
    token: string
    employeeName: string
    stationName: string
  } | null>(null)

  useLayoutEffect(() => {
    setSavedToken(readStationTabletToken())
  }, [])

  const connectValidatedToken = useCallback(
    async (token: string) => {
      setBusy(true)
      setFormError(null)
      const v = await validateTabletSession(token)
      if (!v.ok) {
        setFormError(v.error)
        setBusy(false)
        return
      }
      writeStationTabletToken(token)
      setPhase('connected')
      setBusy(false)
      window.setTimeout(() => {
        navigate(`/tablet/${encodeURIComponent(token)}`, { replace: true })
      }, 1400)
    },
    [navigate],
  )

  const processRawInput = useCallback(
    async (raw: string) => {
      setFormError(null)
      setWrongEmployee(null)
      const p = parseAccessPasteInput(raw)
      if (p.kind === 'invalid') {
        setFormError(p.message)
        return
      }
      if (p.kind === 'employee') {
        setBusy(true)
        const pr = await probeEmployeeAccessSession(p.token)
        setBusy(false)
        if (pr.ok) {
          setWrongEmployee({
            token: p.token,
            employeeName: pr.employee.displayName,
            stationName: pr.station.name,
          })
        } else {
          setFormError('Dieser Zugang ist ungültig oder wurde deaktiviert.')
        }
        return
      }
      if (p.kind === 'tablet') {
        await connectValidatedToken(p.token)
        return
      }
      setBusy(true)
      const tabFirst = await validateTabletSession(p.token)
      if (tabFirst.ok) {
        setBusy(false)
        await connectValidatedToken(p.token)
        return
      }
      const emp = await probeEmployeeAccessSession(p.token)
      setBusy(false)
      if (emp.ok) {
        setWrongEmployee({
          token: p.token,
          employeeName: emp.employee.displayName,
          stationName: emp.station.name,
        })
        return
      }
      setFormError('Dieser Zugang ist ungültig oder wurde deaktiviert.')
    },
    [connectValidatedToken],
  )

  const onQrDecoded = useCallback(
    (text: string) => {
      setScannerOpen(false)
      void processRawInput(text)
    },
    [processRawInput],
  )

  const onManualSubmit = (e: FormEvent) => {
    e.preventDefault()
    void processRawInput(manual)
  }

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
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-[#070b12] px-6 py-12 text-slate-100">
      {phase === 'connected' ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-[#070b12]/92 backdrop-blur-sm">
          <p className="rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-6 py-4 text-center text-base font-medium text-cyan-100 shadow-lg">
            Stations-Tablet erfolgreich verbunden.
          </p>
        </div>
      ) : null}

      <TabletQrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDecoded={onQrDecoded} />

      {wrongEmployee ? (
        <div className="mb-8 w-full max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
          <p className="text-sm font-semibold text-amber-100">
            Dieser QR-Code gehört zu einer Mitarbeiter-App, nicht zu einem Stations-Tablet.
          </p>
          <p className="mt-2 text-xs text-amber-200/85">
            Mitarbeiter-Zugang: {wrongEmployee.employeeName} · {wrongEmployee.stationName}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="primary"
              className="w-full sm:w-auto"
              onClick={() => navigate(`/employee/${encodeURIComponent(wrongEmployee.token)}`, { replace: true })}
            >
              Mitarbeiter-App öffnen
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setWrongEmployee(null)}>
              Zurück
            </Button>
          </div>
        </div>
      ) : null}

      <Tablet className="h-14 w-14 text-cyan-400/90" aria-hidden />
      <h1 className="mt-6 text-center text-xl font-semibold text-white">Kein Stations-Tablet-Zugang gespeichert</h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-400">
        Bitte Stations-QR-Code scannen oder den Tablet-Link aus „Mein Konto · Geräte & Apps“ einfügen.
      </p>

      <div className="mt-8 flex w-full max-w-md flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          className="w-full justify-center py-3 text-base"
          disabled={busy}
          onClick={() => {
            setFormError(null)
            setWrongEmployee(null)
            setScannerOpen(true)
          }}
        >
          Stations-QR scannen
        </Button>

        <p className="text-center text-xs text-slate-500">Oder Tablet-Link manuell eingeben</p>

        <form onSubmit={onManualSubmit} className="flex w-full flex-col gap-2">
          <label className="text-left text-xs font-medium text-slate-400">
            Tablet-Link oder Token
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="https://…/tablet/… oder /tablet/… oder Token"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
              disabled={busy}
            />
          </label>
          <Button type="submit" variant="outline" className="w-full justify-center" disabled={busy}>
            Zugang verbinden
          </Button>
        </form>
      </div>

      {formError ? (
        <p className="mt-6 max-w-md text-center text-sm text-red-300/95" role="alert">
          {formError}
        </p>
      ) : null}

      {showDevHint ? (
        <p className="mt-8 max-w-md text-center text-xs text-slate-500">
          Entwicklung: Terminal ohne Stations-QR unter{' '}
          <Link to="/tablet/dev" className="text-cyan-300 underline hover:text-cyan-200">
            /tablet/dev
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-10 flex flex-col items-center gap-2 text-sm">
        <Link to="/app/zugaenge" className="font-medium text-cyan-400/90 underline-offset-4 hover:underline hover:text-cyan-300">
          Gespeicherte Zugänge verwalten
        </Link>
        <Link to="/" className="text-slate-500 underline-offset-4 hover:underline hover:text-slate-400">
          Zur Startauswahl
        </Link>
      </div>
    </div>
  )
}
