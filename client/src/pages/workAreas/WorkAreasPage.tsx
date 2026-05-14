import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'
import type { WorkAreaDefinition } from '../../types/employee'

export function WorkAreasPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const canView = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))

  const [items, setItems] = useState<WorkAreaDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const res = await apiGet<WorkAreaDefinition[]>('/work-areas', { stationId, includeInactive: 'true' })
    if (!res.ok) {
      setError(res.error)
      setItems([])
    } else setItems(Array.isArray(res.data) ? res.data : [])
    setLoading(false)
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return items
    return items.filter((w) => w.name.toLowerCase().includes(t) || (w.shortCode ?? '').toLowerCase().includes(t))
  }, [items, q])

  const saveRow = async (w: WorkAreaDefinition, patch: Partial<WorkAreaDefinition>) => {
    if (!canEdit || !stationId) return
    setLoading(true)
    setError(null)
    const res = await apiSend<WorkAreaDefinition>('PUT', `/work-areas/${encodeURIComponent(w.id)}`, {
      name: patch.name ?? w.name,
      shortCode: patch.shortCode ?? w.shortCode,
      color: patch.color ?? w.color,
      description: (patch as { description?: string }).description ?? '',
      sortOrder: patch.sortOrder ?? w.sortOrder ?? 0,
      isDefault: patch.isDefault ?? w.isDefault ?? false,
      active: patch.active ?? w.active ?? true,
    })
    if (!res.ok) setError(res.error)
    else await load()
    setLoading(false)
  }

  const create = async () => {
    if (!canEdit || !stationId) return
    const name = window.prompt('Name des neuen Arbeitsbereichs?')
    if (!name?.trim()) return
    setLoading(true)
    setError(null)
    const res = await apiSend<WorkAreaDefinition>('POST', '/work-areas', { name: name.trim(), shortCode: '', color: '#38bdf8' }, { stationId })
    if (!res.ok) setError(res.error)
    else await load()
    setLoading(false)
  }

  const deactivate = async (w: WorkAreaDefinition) => {
    if (!canEdit) return
    if (!window.confirm(`„${w.name}“ deaktivieren? (Bestehende Schichten bleiben erhalten.)`)) return
    await saveRow(w, { active: false })
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Arbeitsbereiche</h1>
        <p className="text-sm text-[var(--text-muted)]">Keine Berechtigung (settings.view).</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-16">
      <PageHeader
        title="Arbeitsbereiche"
        description="Schichtplan-Bereiche pro Station · deaktivierte Bereiche bleiben in historischen Schichten erhalten"
      />

      {error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="w-full max-w-md rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-cyan-400/50"
          placeholder="Suche …"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {canEdit ? (
          <Button type="button" onClick={() => void create()}>
            Arbeitsbereich erstellen
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {loading && !items.length ? (
          <p className="text-sm text-[var(--text-muted)]">Lade …</p>
        ) : filtered.length === 0 ? (
          <Card padding="md" className="border-[var(--border-subtle)] sm:col-span-2">
            <p className="text-sm text-[var(--text-muted)]">Noch keine Einträge oder keine Treffer.</p>
            {canEdit ? (
              <Button type="button" className="mt-3" onClick={() => void create()}>
                Ersten Arbeitsbereich erstellen
              </Button>
            ) : null}
          </Card>
        ) : (
          filtered.map((w) => (
            <Card key={w.id} padding="md" className="border-[var(--border-subtle)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: w.color }} />
                    <h3 className="text-base font-semibold text-[var(--text-main)]">{w.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-faint)]">
                    Kurzcode: {w.shortCode || '—'} · Sortierung: {w.sortOrder ?? 0}
                    {w.isDefault ? ' · Standard' : ''}
                  </p>
                  <p className="mt-2 text-xs">
                    <span
                      className={
                        w.active === false
                          ? 'rounded bg-amber-500/15 px-2 py-0.5 text-amber-100'
                          : 'rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-100'
                      }
                    >
                      {w.active === false ? 'Inaktiv' : 'Aktiv'}
                    </span>
                  </p>
                </div>
              </div>
              {canEdit ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const name = window.prompt('Name', w.name)
                      if (name == null) return
                      void saveRow(w, { name: name.trim() })
                    }}
                  >
                    Umbenennen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const c = window.prompt('Farbe (Hex)', w.color)
                      if (c == null) return
                      void saveRow(w, { color: c.trim() || w.color })
                    }}
                  >
                    Farbe
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void saveRow(w, { isDefault: true })
                    }}
                  >
                    Als Standard
                  </Button>
                  {w.active !== false ? (
                    <Button type="button" variant="ghost" className="text-amber-100/90" onClick={() => void deactivate(w)}>
                      Deaktivieren
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => void saveRow(w, { active: true })}>
                      Reaktivieren
                    </Button>
                  )}
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
