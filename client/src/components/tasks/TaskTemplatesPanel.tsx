import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import type { TaskTemplate, TaskTemplateAssignmentStat, TaskTemplateYearStat } from '../../types/taskTemplate'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

const TYPE_FILTER: { id: string; label: string }[] = [
  { id: '', label: 'Alle Typen' },
  { id: 'daily', label: 'Täglich / Pflicht' },
  { id: 'weekend_dynamic', label: 'Wochenende (Pool)' },
  { id: 'yearly', label: 'Jahresaufgabe' },
  { id: 'once', label: 'Einmalig' },
  { id: 'weekly', label: 'Wöchentlich' },
  { id: 'monthly', label: 'Monatlich' },
  { id: 'shift_close', label: 'Schichtabschluss' },
  { id: 'handover', label: 'Übergabe' },
  { id: 'backshop', label: 'Backshop' },
]

function typeLabel(t: string): string {
  const hit = TYPE_FILTER.find((x) => x.id === t)
  return hit?.label ?? t
}

function freqLabel(t: TaskTemplate): string {
  if (t.templateType === 'yearly' && t.maxPerYear != null) return `${t.maxPerYear}× pro Jahr`
  if (t.frequencyType === 'every_shift' || t.appliesEveryShift) return 'Jede Schicht'
  return t.frequencyType || '—'
}

export function TaskTemplatesPanel() {
  const { stationId } = useStation()
  const year = useMemo(() => new Date().getFullYear(), [])
  const [typeFilter, setTypeFilter] = useState('')
  const [rows, setRows] = useState<TaskTemplate[]>([])
  const [yearlyStats, setYearlyStats] = useState<TaskTemplateYearStat[]>([])
  const [dynStats, setDynStats] = useState<TaskTemplateAssignmentStat[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [edit, setEdit] = useState<TaskTemplate | null>(null)

  const load = useCallback(async () => {
    if (!stationId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    const [listRes, statRes] = await Promise.all([
      apiGet<TaskTemplate[]>('/task-templates', { stationId, templateType: typeFilter || undefined }),
      apiGet<{ yearly: TaskTemplateYearStat[]; dynamic: TaskTemplateAssignmentStat[] }>('/task-templates/stats/year', {
        stationId,
        year: String(year),
      }),
    ])
    if (listRes.ok && Array.isArray(listRes.data)) setRows(listRes.data)
    else {
      setRows([])
      setErr(listRes.ok === false ? listRes.error : 'Laden fehlgeschlagen')
    }
    if (statRes.ok && statRes.data) {
      setYearlyStats(statRes.data.yearly ?? [])
      setDynStats(statRes.data.dynamic ?? [])
    } else {
      setYearlyStats([])
      setDynStats([])
    }
    setLoading(false)
  }, [stationId, typeFilter, year])

  useEffect(() => {
    void load()
  }, [load])

  const yearlyByKey = useMemo(() => new Map(yearlyStats.map((y) => [y.templateKey, y])), [yearlyStats])
  const dynByKey = useMemo(() => new Map(dynStats.map((y) => [y.templateKey, y])), [dynStats])

  const saveEdit = async () => {
    if (!stationId || !edit) return
    const res = await apiSend<TaskTemplate>('PATCH', `/task-templates/${encodeURIComponent(edit.id)}`, edit, { stationId })
    if (!res.ok) {
      window.alert(res.error)
      return
    }
    setEdit(null)
    await load()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Vorlagen steuern automatische Wochenend-Zuweisungen und Pflichten. Geplante und erledigte Einzelaufgaben findest du in den Tabs „Geplant“ und
        „Historie“.
      </p>
      {err ? (
        <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">{err}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTER.map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
              typeFilter === f.id ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100' : 'border-white/10 text-[var(--text-muted)] hover:border-white/20'
            }`}
            onClick={() => setTypeFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading ? <p className="text-sm text-[var(--text-muted)]">Vorlagen werden geladen…</p> : null}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2">Titel</th>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Häufigkeit</th>
              <th className="px-3 py-2">Pflicht</th>
              <th className="px-3 py-2">Dynamisch</th>
              <th className="px-3 py-2">Aktiv</th>
              <th className="px-3 py-2">Jahr / Zuweisung</th>
              <th className="px-3 py-2 w-24">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => {
              const ys = yearlyByKey.get(r.templateKey)
              const ds = dynByKey.get(r.templateKey)
              const yearCell =
                r.templateType === 'yearly' && ys
                  ? `${ys.completedThisYear}${ys.maxPerYear != null ? ` / ${ys.maxPerYear}` : ''} erledigt`
                  : ds?.lastAssignedAt
                    ? `Zuletzt: ${ds.lastAssignedAt.slice(0, 10)}`
                    : '—'
              return (
                <tr key={r.id} className="hover:bg-white/5">
                  <td className="px-3 py-2 font-medium text-[var(--text-main)]">{r.title}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{typeLabel(r.templateType)}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{freqLabel(r)}</td>
                  <td className="px-3 py-2">{r.isRequired ? 'Ja' : 'Nein'}</td>
                  <td className="px-3 py-2">{r.dynamicAssignment ? 'Ja' : 'Nein'}</td>
                  <td className="px-3 py-2">{r.active ? 'Ja' : 'Nein'}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{yearCell}</td>
                  <td className="px-3 py-2">
                    <Button type="button" variant="ghost" onClick={() => setEdit({ ...r })} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                      Bearbeiten
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[var(--bg-elevated)] p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Vorlage bearbeiten</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Schlüssel: {edit.templateKey}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-[var(--text-muted)]">
                Titel
                <Input className="mt-1" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </label>
              <label className="block text-xs text-[var(--text-muted)]">
                Beschreibung
                <Input className="mt-1" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </label>
              <label className="block text-xs text-[var(--text-muted)]">
                Kategorie
                <Input className="mt-1" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
              </label>
              <label className="block text-xs text-[var(--text-muted)]">
                Vorlagen-Typ
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm"
                  value={edit.templateType}
                  onChange={(e) => setEdit({ ...edit, templateType: e.target.value })}
                >
                  {TYPE_FILTER.filter((x) => x.id).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {edit.templateType === 'yearly' ? (
                <label className="block text-xs text-[var(--text-muted)]">
                  Max. pro Jahr
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    max={20}
                    value={edit.maxPerYear ?? ''}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        maxPerYear: e.target.value === '' ? null : Math.min(20, Math.max(0, Number(e.target.value))),
                      })
                    }
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
                Aktiv
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.dynamicAssignment} onChange={(e) => setEdit({ ...edit, dynamicAssignment: e.target.checked })} />
                Automatisch verteilen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.isRequired} onChange={(e) => setEdit({ ...edit, isRequired: e.target.checked })} />
                Pflicht
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.onlyWeekend} onChange={(e) => setEdit({ ...edit, onlyWeekend: e.target.checked })} />
                Nur Wochenende
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.appliesEarlyShift} onChange={(e) => setEdit({ ...edit, appliesEarlyShift: e.target.checked })} />
                Frühschicht
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.appliesLateShift} onChange={(e) => setEdit({ ...edit, appliesLateShift: e.target.checked })} />
                Spätschicht
              </label>
              <label className="block text-xs text-[var(--text-muted)]">
                Sortierung
                <Input
                  className="mt-1"
                  type="number"
                  value={edit.sortOrder}
                  onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEdit(null)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" onClick={() => void saveEdit()}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
