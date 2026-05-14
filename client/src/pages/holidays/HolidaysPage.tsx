import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'
import { GERMAN_HOLIDAYS } from '../../data/germanHolidays'
import type { GermanState } from '../../data/germanHolidays'
import { holidayAppliesToState } from '../../utils/holidayUtils'

type ExtraHoliday = {
  id: string
  date: string
  name: string
  countsAsPublic: boolean
  countsAsSpecial: boolean
  active: boolean
}

export function HolidaysPage() {
  const { stationId, federalState, hasPermission } = useStation()
  const { user } = useAuth()
  const state = federalState as GermanState
  const canView = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))

  const statutory = useMemo(() => GERMAN_HOLIDAYS.filter((h) => holidayAppliesToState(h, state)).sort((a, b) => a.date.localeCompare(b.date)), [state])

  const [extras, setExtras] = useState<ExtraHoliday[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const res = await apiGet<ExtraHoliday[]>('/station-extra-holidays', { stationId, includeInactive: 'true' })
    if (!res.ok) {
      setError(res.error)
      setExtras([])
    } else setExtras(Array.isArray(res.data) ? res.data : [])
    setLoading(false)
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  const addCustom = async () => {
    if (!canEdit || !stationId) return
    const name = window.prompt('Name des Zusatz-Feiertags?')
    if (!name?.trim()) return
    const date = window.prompt('Datum (YYYY-MM-DD)?')
    if (!date?.trim()) return
    setLoading(true)
    const res = await apiSend<ExtraHoliday>(
      'POST',
      '/station-extra-holidays',
      {
        name: name.trim(),
        date: date.trim(),
        isLegal: false,
        countsAsPublic: true,
        countsAsSpecial: false,
      },
      { stationId },
    )
    if (!res.ok) setError(res.error)
    else await load()
    setLoading(false)
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Feiertage</h1>
        <p className="text-sm text-[var(--text-muted)]">Keine Berechtigung (settings.view).</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-16">
      <PageHeader
        title="Feiertage"
        description={`Kalender 2026 · Bundesland ${state} · Zusatz-Tage fließen in Lohn/Zuschläge ein, sofern „zählt als gesetzlich“ aktiv ist.`}
      />
      {error ? <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {canEdit ? (
        <Button type="button" onClick={() => void addCustom()}>
          Zusatz-Feiertag
        </Button>
      ) : null}

      <Card padding="md" className="border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--text-main)]">Gesetzliche & regionale Feiertage ({state})</h2>
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-sm text-[var(--text-muted)]">
          {statutory.map((h) => (
            <li key={h.id} className="flex justify-between gap-2 border-b border-white/5 py-1">
              <span>{h.name}</span>
              <span className="tabular-nums text-[var(--text-faint)]">{h.date}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="md" className="border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--text-main)]">Stationsspezifische Zusatz-Feiertage</h2>
        {loading && !extras.length ? <p className="mt-2 text-sm text-[var(--text-muted)]">Lade …</p> : null}
        {!loading && extras.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Noch keine Zusatz-Feiertage.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {extras.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                <span>
                  {e.name} <span className="text-[var(--text-faint)]">({e.date})</span>
                </span>
                <span className="text-xs text-[var(--text-faint)]">
                  {e.active ? 'aktiv' : 'inaktiv'} · öffentlich: {e.countsAsPublic ? 'ja' : 'nein'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
