import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { inputClass } from '../../components/schedule/shift/fieldStyles'

type RoutineType = 'weekday' | 'weekend' | 'holiday'

type Item = {
  id: string
  routineId: string
  name: string
  quantity: number
  unit: string
  category: string | null
  sortOrder: number
  active: boolean
  validFrom?: string | null
  validTo?: string | null
  restrictDayType?: string | null
  notes?: string | null
}

type Routine = {
  id: string
  stationId: string
  routineType: RoutineType
  title: string
  description: string | null
  active: boolean
  items: Item[]
}

const TAB_LABEL: Record<RoutineType, string> = {
  weekday: 'Normaler Wochentag',
  weekend: 'Wochenende',
  holiday: 'Feiertag',
}

export function BackshopRoutinePanel() {
  const { stationId, hasPermission } = useStation()
  const canEdit = hasPermission('tasks.edit')
  const canView = hasPermission('tasks.view') || canEdit
  const [routines, setRoutines] = useState<Routine[]>([])
  const [tab, setTab] = useState<RoutineType>('weekday')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const current = useMemo(() => routines.find((r) => r.routineType === tab), [routines, tab])

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setErr(null)
    const res = await apiGet<{ routines: Routine[] }>('/backshop-routines', { stationId })
    if (!res.ok) {
      setErr(res.error)
      setRoutines([])
    } else {
      setRoutines(res.data.routines ?? [])
    }
    setLoading(false)
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  const saveRoutineMeta = async (patch: { title?: string; active?: boolean }) => {
    if (!current || !canEdit) return
    setSaving(true)
    setErr(null)
    const res = await apiSend('PUT', `/backshop-routines/${encodeURIComponent(current.id)}`, patch)
    setSaving(false)
    if (!res.ok) setErr(res.error)
    else void load()
  }

  const addItem = async () => {
    if (!current || !canEdit) return
    const name = window.prompt('Artikelbezeichnung?')
    if (!name?.trim()) return
    setErr(null)
    const res = await apiSend('POST', `/backshop-routines/${encodeURIComponent(current.id)}/items`, {
      name: name.trim(),
      quantity: 1,
      unit: 'Stück',
      category: 'Backwaren',
    })
    if (!res.ok) setErr(res.error)
    else void load()
  }

  const editItemQty = async (it: Item) => {
    if (!canEdit) return
    const q = window.prompt('Menge?', String(it.quantity))
    if (q == null || q.trim() === '' || !Number.isFinite(Number(q))) return
    setErr(null)
    const res = await apiSend('PUT', `/backshop-routines/items/${encodeURIComponent(it.id)}`, { quantity: Number(q) })
    if (!res.ok) setErr(res.error)
    else void load()
  }

  const deactivateItem = async (it: Item) => {
    if (!canEdit || !window.confirm('Artikel deaktivieren? Er erscheint dann nicht mehr im Popup.')) return
    setErr(null)
    const res = await apiSend('PUT', `/backshop-routines/items/${encodeURIComponent(it.id)}`, { active: false })
    if (!res.ok) setErr(res.error)
    else void load()
  }

  const reactivateItem = async (it: Item) => {
    if (!canEdit) return
    setErr(null)
    const res = await apiSend('PUT', `/backshop-routines/items/${encodeURIComponent(it.id)}`, { active: true })
    if (!res.ok) setErr(res.error)
    else void load()
  }

  const hardDeleteItem = async (it: Item) => {
    if (!canEdit || !window.confirm('Artikel endgültig aus der Datenbank löschen?')) return
    setErr(null)
    const res = await apiSend('DELETE', `/backshop-routines/items/${encodeURIComponent(it.id)}`)
    if (!res.ok) setErr(res.error)
    else void load()
  }

  if (!stationId) return <p className="text-sm text-[var(--text-muted)]">Bitte Station wählen.</p>
  if (!canView) return <p className="text-sm text-rose-300">Keine Berechtigung (tasks.view).</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_LABEL) as RoutineType[]).map((k) => (
          <Button key={k} type="button" variant={tab === k ? 'primary' : 'outline'} onClick={() => setTab(k)}>
            {TAB_LABEL[k]}
          </Button>
        ))}
      </div>
      {err ? <p className="text-sm text-rose-300">{err}</p> : null}
      {loading ? <p className="text-sm text-[var(--text-muted)]">Lade…</p> : null}
      {current ? (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-main)]">{current.title}</h2>
              <p className="text-xs text-[var(--text-faint)]">Routine-Typ: {TAB_LABEL[current.routineType]}</p>
            </div>
            {canEdit ? (
              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={current.active}
                  onChange={(e) => void saveRoutineMeta({ active: e.target.checked })}
                  disabled={saving}
                />
                Aktiv
              </label>
            ) : null}
          </div>
          {canEdit ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-[var(--text-faint)]">
                Popup-Titel
                <input
                  type="text"
                  defaultValue={current.title}
                  key={`${current.id}-title`}
                  id={`backshop-title-${current.id}`}
                  className={`${inputClass} min-w-[12rem] max-w-md`}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  const el = document.getElementById(`backshop-title-${current.id}`) as HTMLInputElement | null
                  void saveRoutineMeta({ title: el?.value ?? current.title })
                }}
              >
                Titel speichern
              </Button>
            </div>
          ) : null}
          <ul className="mt-4 space-y-2">
            {current.items
              .filter((i) => i.active)
              .map((it) => (
                <li
                  key={it.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-[var(--text-main)]">
                    {it.sortOrder}. {it.name} · {it.quantity} {it.unit}
                  </span>
                  {canEdit ? (
                    <span className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" className="text-xs" onClick={() => void editItemQty(it)}>
                        Menge
                      </Button>
                      <Button type="button" variant="ghost" className="text-xs" onClick={() => void deactivateItem(it)}>
                        Deaktivieren
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
          {canEdit && current.items.some((i) => !i.active) ? (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3">
              <p className="text-xs font-medium text-[var(--text-faint)]">Inaktive Artikel</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                {current.items
                  .filter((i) => !i.active)
                  .map((it) => (
                    <li key={it.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {it.name} · {it.quantity} {it.unit}
                      </span>
                      <span className="flex gap-2">
                        <Button type="button" variant="ghost" className="text-xs" onClick={() => void reactivateItem(it)}>
                          Aktivieren
                        </Button>
                        <Button type="button" variant="ghost" className="text-xs text-rose-300" onClick={() => void hardDeleteItem(it)}>
                          Löschen
                        </Button>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          {canEdit ? (
            <Button type="button" variant="outline" className="mt-4" onClick={() => void addItem()}>
              Artikel hinzufügen
            </Button>
          ) : null}
        </Card>
      ) : !loading ? (
        <p className="text-sm text-[var(--text-muted)]">Keine Routinen für diese Station. Bitte Server-Migration prüfen.</p>
      ) : null}
      <p className="text-xs text-[var(--text-faint)]">
        Feiertage (BW) haben Vorrang: an gesetzlichen Feiertagen erscheint die Feiertags-Liste, auch unter der Woche.
        Bearbeiten: Chef/Stationsleitung/Teamleitung (tasks.edit).
      </p>
    </div>
  )
}
