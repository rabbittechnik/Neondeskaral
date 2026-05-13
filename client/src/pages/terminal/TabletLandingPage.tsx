import { useCallback, useLayoutEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Tablet } from 'lucide-react'
import { TabletQrScannerModal } from '../../components/terminal/TabletQrScannerModal'
import { Button } from '../../components/ui/Button'
import { readStationTabletToken, writeStationTabletToken } from '../../utils/stationTabletToken'
import { extractTabletTokenFromQrText, validateTabletSession } from '../../utils/tabletQrToken'

/** `/tablet` — gespeicherter Token, oder Einrichtung per QR / manueller Eingabe. */
export function TabletLandingPage() {
  const navigate = useNavigate()
  const [savedToken, setSavedToken] = useState<string | null | undefined>(undefined)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'connected'>('idle')

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
      const extracted = extractTabletTokenFromQrText(raw)
      if (extracted.error || !extracted.token) {
        setFormError(extracted.error ?? 'Ungültiger Inhalt.')
        return
      }
      await connectValidatedToken(extracted.token)
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

      <Tablet className="h-14 w-14 text-cyan-400/90" aria-hidden />
      <h1 className="mt-6 text-center text-xl font-semibold text-white">Kein Tablet-Zugang angegeben</h1>
      <p className="mt-3 max-w-md text-center text-sm text-slate-400">
        Bitte richte das Stations-Tablet ein — per Kamera oder durch Einfügen des Links aus „Mein Konto · Geräte &
        Apps“.
      </p>

      <div className="mt-8 flex w-full max-w-md flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          className="w-full justify-center py-3 text-base"
          disabled={busy}
          onClick={() => {
            setFormError(null)
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
              placeholder="https://…/tablet/… oder Token"
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

      <Link
        to="/"
        className="mt-10 text-sm font-medium text-cyan-400/90 underline-offset-4 hover:underline hover:text-cyan-300"
      >
        Zur Startauswahl
      </Link>
    </div>
  )
}
