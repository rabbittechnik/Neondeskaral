import { useCallback, useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import type { FuelPricesPayload } from '../../context/tablet-terminal-context'

type Props = {
  fetchFuelPrices: (opts?: { forceRefresh?: boolean }) => Promise<FuelPricesPayload>
}

function formatEur(n: number): string {
  return `${n.toFixed(3).replace('.', ',')} €`
}

function formatDeDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return (
    d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' Uhr'
  )
}

export function TabletFuelPricesTab({ fetchFuelPrices }: Props) {
  const [data, setData] = useState<FuelPricesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(
    async (force?: boolean) => {
      setLoading(true)
      setErr(null)
      try {
        const res = await fetchFuelPrices({ forceRefresh: force })
        setData(res)
        if (!res.ok) {
          setErr(res.message)
        } else if (res.cacheWarning) {
          setErr(res.cacheWarning)
        } else {
          setErr(null)
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
    const id = window.setInterval(() => void load(false), 5 * 60 * 1000)
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
        ) : (
          <p className="mt-2 text-[var(--text-muted)]">Aral Bodelshausen</p>
        )}
      </div>

      {loading && !success ? (
        <p className="text-center text-[var(--text-muted)]">Lade Preise…</p>
      ) : null}

      {data && !data.ok ? (
        <div className="rounded-2xl border border-amber-500 border-opacity-40 bg-amber-950 bg-opacity-40 p-6 text-center text-amber-100">
          <p className="text-lg">{data.message}</p>
          {!data.configured ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Bitte nur im Railway-Server die Umgebungsvariable TANKERKOENIG_API_KEY setzen, nicht im Client-Service.
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
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Super E10', v: success.prices.e10 },
              { label: 'Super E5', v: success.prices.e5 },
              { label: 'Diesel', v: success.prices.diesel },
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
              <span className="text-[var(--text-faint)]">Letzte Aktualisierung:</span>{' '}
              <span className="text-cyan-100">{formatDeDateTime(success.fetchedAt)}</span>
            </p>
            <p className="mt-2">
              <span className="text-[var(--text-faint)]">Quelle:</span> {success.source}
            </p>
          </div>
          <div className="flex justify-center">
            <Button type="button" variant="primary" className="min-w-[200px]" onClick={() => void load(true)} disabled={loading}>
              {loading ? '…' : 'Aktualisieren'}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
