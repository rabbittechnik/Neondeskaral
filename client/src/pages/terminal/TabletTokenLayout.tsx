import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { GermanState } from '../../data/germanHolidays'
import { StationProvider } from '../../context/station-context'
import { TabletTerminalProvider } from '../../context/tablet-terminal-context'
import { TerminalLayout } from '../../layouts/TerminalLayout'
import { API_BASE } from '../../services/api'

function toGermanState(raw: string | undefined): GermanState {
  const s = String(raw ?? 'BW').toUpperCase()
  const allowed: GermanState[] = [
    'BW',
    'BY',
    'BE',
    'BB',
    'HB',
    'HH',
    'HE',
    'MV',
    'NI',
    'NW',
    'RP',
    'SL',
    'SN',
    'ST',
    'SH',
    'TH',
  ]
  return (allowed.includes(s as GermanState) ? s : 'BW') as GermanState
}

type SessionOk = {
  station: { id: string; name: string; federalState: string }
  tablet: { id: string; name: string }
}

/**
 * Lädt Station aus Tablet-Token, kein Admin-Login.
 * Kinder: Route mit StaffTerminalPage innerhalb TerminalLayout (`Outlet`).
 */
export function TabletTokenLayout() {
  const { tabletToken } = useParams()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionOk | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const token = String(tabletToken ?? '').trim()
    if (!token) {
      setLoading(false)
      setSession(null)
      setErrorMsg('Kein Tablet-Zugang angegeben.')
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setErrorMsg(null)
      try {
        const res = await fetch(`${API_BASE}/tablet/session/${encodeURIComponent(token)}`)
        const json = (await res.json()) as { ok?: boolean; data?: SessionOk; error?: string }
        if (cancelled) return
        if (!res.ok || json.ok === false || !json.data?.station?.id) {
          const err =
            json.error ?? 'Dieser Stations-Tablet-Zugang ist ungültig oder wurde deaktiviert.'
          setSession(null)
          setErrorMsg(err)
          setLoading(false)
          return
        }
        setSession(json.data)
      } catch {
        if (!cancelled) {
          setSession(null)
          setErrorMsg('Server nicht erreichbar.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tabletToken])

  useEffect(() => {
    if (loading) {
      document.title = `Stations-Terminal · Rabbit-Technik Station`
      return
    }
    if (session) {
      document.title = `${session.tablet.name} · ${session.station.name}`
      return
    }
    document.title = `Stations-Terminal · Rabbit-Technik Station`
  }, [loading, session])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-main)] text-[var(--text-muted)]">
        <p>Lade Stations-Terminal…</p>
      </div>
    )
  }

  if (!session || errorMsg) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#070b12] px-6 py-12 text-slate-200">
        <h1 className="text-lg font-semibold text-white">Stations-Terminal</h1>
        <p className="mt-4 max-w-md text-center text-sm text-slate-400">{errorMsg ?? 'Nicht erreichbar.'}</p>
        <p className="mt-2 max-w-md text-center text-xs text-slate-500">
          Bei Fragen zur Freischaltung bitte die Stationsleitung informieren — es ist keine Administrator-Anmeldung
          nötig.
        </p>
        <Link
          to="/"
          className="mt-10 text-sm text-cyan-400/90 underline-offset-4 hover:underline hover:text-cyan-300"
        >
          Zur Startauswahl
        </Link>
      </div>
    )
  }

  const token = String(tabletToken ?? '').trim()

  return (
    <StationProvider
      fixedTabletStation={{
        stationId: session.station.id,
        stationName: session.station.name,
        federalState: toGermanState(session.station.federalState),
      }}
    >
      <TabletTerminalProvider tabletToken={token}>
        <TerminalLayout />
      </TabletTerminalProvider>
    </StationProvider>
  )
}
