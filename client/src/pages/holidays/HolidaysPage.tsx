import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { HolidayEditModal } from '../../components/holidays/HolidayEditModal'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'
import type { StationHoliday } from '../../types/stationHoliday'
import { categoryBadgeLabel, PAYROLL_HOLIDAY_CATEGORY_LABELS, timeRangeLabel } from '../../types/stationHoliday'

function categoryBadgeTone(h: StationHoliday): 'default' | 'cyan' | 'amber' | 'success' {
  if (h.payrollCategory === 'none' || !h.active) return 'default'
  if (h.payrollCategory === 'special') return 'amber'
  if (h.payrollCategory === 'special_rule') return 'cyan'
  return 'success'
}

export function HolidaysPage() {
  const { stationId, federalState, hasPermission } = useStation()
  const { user } = useAuth()
  const canView = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))

  const [holidays, setHolidays] = useState<StationHoliday[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('edit')
  const [editing, setEditing] = useState<StationHoliday | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const res = await apiGet<StationHoliday[]>('/station-extra-holidays', {
      stationId,
      includeInactive: 'true',
      year: '2026',
    })
    if (!res.ok) {
      setError(res.error)
      setHolidays([])
    } else {
      setHolidays(Array.isArray(res.data) ? res.data : [])
    }
    setLoading(false)
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)),
    [holidays],
  )

  const openCreate = () => {
    setEditMode('create')
    setEditing(null)
    setEditOpen(true)
  }

  const openEdit = (h: StationHoliday) => {
    setEditMode('edit')
    setEditing(h)
    setEditOpen(true)
  }

  const saveHoliday = async (payload: Partial<StationHoliday> & { name: string; date: string }) => {
    if (!canEdit || !stationId) return
    setLoading(true)
    setError(null)
    if (editMode === 'create') {
      const res = await apiSend<StationHoliday>('POST', '/station-extra-holidays', payload, { stationId })
      if (!res.ok) setError(res.error)
    } else if (editing?.id) {
      const res = await apiSend<StationHoliday>('PUT', `/station-extra-holidays/${editing.id}`, payload)
      if (!res.ok) setError(res.error)
    }
    await load()
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
    <div className="mx-auto max-w-6xl space-y-6 p-6 pb-16">
      <PageHeader
        title="Feiertage"
        description={`Kalender 2026 · Bundesland ${federalState}. Gesetzliche Feiertage werden automatisch geladen und können pro Eintrag angepasst werden. Für die Lohnabrechnung gilt die Kategorie des Tages; der Prozentsatz kommt aus dem Mitarbeiterprofil.`}
      />

      {error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
      ) : null}

      {canEdit ? (
        <Button type="button" onClick={openCreate}>
          Zusatz-Feiertag
        </Button>
      ) : null}

      <Card padding="none" className="min-w-0 overflow-hidden border-[var(--border-subtle)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--table-head-bg)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Kategorie</th>
                <th className="px-3 py-2 font-medium">Zuschlag (Hinweis)</th>
                <th className="px-3 py-2 font-medium">Zeitraum</th>
                <th className="px-3 py-2 font-medium">Aktiv</th>
                <th className="px-3 py-2 font-medium">Notiz</th>
                {canEdit ? <th className="px-3 py-2 font-medium">Aktion</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading && !sorted.length ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-3 py-6 text-[var(--text-muted)]">
                    Lade Feiertage…
                  </td>
                </tr>
              ) : null}
              {!loading && sorted.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-3 py-6 text-[var(--text-muted)]">
                    Keine Feiertage vorhanden.
                  </td>
                </tr>
              ) : null}
              {sorted.map((h) => (
                <tr
                  key={h.id}
                  className={`border-b border-white/5 ${h.payrollCategory === 'special' ? 'bg-amber-500/[0.04]' : ''}`}
                >
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--text-main)]">{h.date}</td>
                  <td className="px-3 py-2 text-[var(--text-main)]">
                    {h.name}
                    {h.source === 'custom' ? (
                      <span className="ml-1 text-[10px] text-[var(--text-faint)]">(Zusatz)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {PAYROLL_HOLIDAY_CATEGORY_LABELS[h.payrollCategory]}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={categoryBadgeTone(h)}>{categoryBadgeLabel(h)}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--text-muted)]">{timeRangeLabel(h)}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{h.active ? 'aktiv' : 'inaktiv'}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-[var(--text-faint)]" title={h.note}>
                    {h.note || '—'}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1 px-2 py-1 text-xs"
                        onClick={() => openEdit(h)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Bearbeiten
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <HolidayEditModal
        open={editOpen}
        mode={editMode}
        holiday={editing}
        federalState={federalState}
        onClose={() => setEditOpen(false)}
        onSave={(p) => void saveHoliday(p)}
      />
    </div>
  )
}
