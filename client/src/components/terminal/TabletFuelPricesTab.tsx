import { useCallback, useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import type { FuelPricesPayload } from '../../context/tablet-terminal-context'

type Props = {
  fetchFuelPrices: (opts?: { forceRefresh?: boolean }) => Promise<FuelPricesPayload>
}

function formatEur(n: number): string {
  return `${n.toFixed(3).replace('.', ',')} €`
}

/** Nur Uhrzeit, z. B. 10:55 Uhr */
function formatDeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
}

const POLL_MS = 45_000

export function TabletFuelPricesTab({ fetchFuelPrices }: Props) {
  const [data, setData] = useState<FuelPricesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const load = useCallback(
    async (force?: boolean) => {
      setLoading(true)
      setErr(null)
      setInfo(null)
      try {
        const res = await fetchFuelPrices({ forceRefresh: force })
        setData(res)
        if (!res.ok) {
          setErr(res.message)
        } else {
          setErr(res.cacheWarning ?? null)
          setInfo(res.infoMessage ?? null)
        }
      } catch {
        setErr('Server nicht erreichbar. Bitte Verbindung prüfen.')
      }
      setLoading(false)
    },
    [fetchFuelPrices],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => void load(false), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  const success = data && data.ok === true ? data : null

  return (
    <div className="mx-auto mt-8 w-full max-w-4xl space-y-6 px-2">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-cyan-100 sm:text-3xl">Aktuelle Spritpreise</h2>
        {success ? (
          <p className="mt-2 text-lg text-[var(--text-muted)]">
            {success.station.name}
            <br />
            {success.station.street} {success.station.houseNumber}, {success.station.postCode} {success.station.place}
          </p>
        ) : !loading ? (
          <p className="mt-2 text-[var(--text-muted)]">Preise über Rabbit-Technik Station (Backend-Cache)</p>
        ) : null}
      </div>

      {loading && !success ? (
        <p className="text-center text-[var(--text-muted)]">Lade Preise…</p>
      ) : null}

      {data && !data.ok ? (
        <div className="rounded-2xl border border-amber-500 border-opacity-40 bg-amber-950 bg-opacity-40 p-6 text-center text-amber-100">
          <p className="text-lg">{data.message}</p>
          {!data.configured ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Tankerkönig API-Key nur im Server setzen (<span className="text-slate-400">TANKERKOENIG_API_KEY</span> in
              Railway), nicht im Client.
            </p>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <>
          {err ? (
            <p className="rounded-xl border border-amber-400 border-opacity-50 bg-amber-950 bg-opacity-30 px-4 py-3 text-center text-sm text-amber-100">
              {err}
            </p>
          ) : null}
          {info ? (
            <p className="rounded-xl border border-slate-500/40 bg-slate-900/50 px-4 py-3 text-center text-sm text-slate-200">
              {info}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Diesel', v: success.prices.diesel },
              { label: 'Super E5', v: success.prices.e5 },
              { label: 'Super E10', v: success.prices.e10 },
            ].map((x) => (
              <div
                key={x.label}
                className="rounded-2xl border border-cyan-500 border-opacity-40 bg-gradient-to-br from-slate-900 to-black p-6 text-center shadow-lg"
              >
                <p className="text-sm font-medium uppercase tracking-wider text-cyan-200">{x.label}</p>
                <p className="mt-4 text-4xl font-bold tabular-nums text-cyan-50 sm:text-5xl">{formatEur(x.v)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white border-opacity-10 bg-neutral-950 p-5 text-center text-[var(--text-muted)]">
            <p>
              <span className="text-[var(--text-faint)]">Status:</span>{' '}
              <span className="font-semibold text-[var(--text-main)]">{success.isOpen ? 'Geöffnet' : 'Geschlossen'}</span>
            </p>
            <p className="mt-2">
              <span className="text-[var(--text-faint)]">
                {success.fromCache ? 'Letzte Aktualisierung:' : 'Aktualisiert:'}
              </span>{' '}
              <span className="text-cyan-100">{formatDeTime(success.fetchedAt)}</span>
              {success.fromCache ? (
                <span className="ml-2 text-xs text-slate-500">(Backend-Cache, bis zu 60 s zwischen Tankerkönig-Abrufen)</span>
              ) : null}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Automatische Aktualisierung alle {POLL_MS / 1000} s über das Backend — ohne direkte Tankerkönig-Aufrufe vom
              Tablet.
            </p>
            <p className="mt-2">
              <span className="text-[var(--text-faint)]">Quelle:</span> {success.source}
            </p>
          </div>
          <div className="flex justify-center">
            <Button
              type="button"
              variant="primary"
              className="min-w-[200px]"
              onClick={() => void load(true)}
              disabled={loading}
            >
              {loading ? '…' : 'Jetzt aktualisieren'}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
