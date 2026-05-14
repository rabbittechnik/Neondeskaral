import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { useWorkAreas } from '../../context/work-areas-context'
import { apiGet, apiSend } from '../../services/api'
import type { VacationBlock } from '../../types/absence'

export function VacationBlocksPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const { definitions: workAreas } = useWorkAreas()
  const canView = Boolean(user?.globalAdmin || hasPermission('absences.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('absences.create'))

  const [items, setItems] = useState<VacationBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const res = await apiGet<VacationBlock[]>('/vacation-blocks', { stationId, includeInactive: 'true' })
    if (!res.ok) {
      setError(res.error)
      setItems([])
    } else setItems(Array.isArray(res.data) ? res.data : [])
    setLoading(false)
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!canEdit || !stationId) return
    const title = window.prompt('Titel der Urlaubssperre?')
    if (!title?.trim()) return
    const start = window.prompt('Von (YYYY-MM-DD)?', new Date().toISOString().slice(0, 10))
    if (!start?.trim()) return
    const end = window.prompt('Bis (YYYY-MM-DD)?', start.trim())
    if (!end?.trim()) return
    setLoading(true)
    const res = await apiSend<VacationBlock>('POST', '/vacation-blocks', { title: title.trim(), startDate: start.trim(), endDate: end.trim(), workAreaIds: [] }, { stationId })
    if (!res.ok) setError(res.error)
    else await load()
    setLoading(false)
  }

  const setAreas = async (b: VacationBlock) => {
    if (!canEdit || !stationId) return
    const ids = workAreas.map((w) => w.id).join(',')
    const raw = window.prompt(`Arbeitsbereich-IDs (Komma), leer = alle Station:\n${ids}`, b.workAreaIds.join(','))
    if (raw == null) return
    const workAreaIds = raw.trim() ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
    setLoading(true)
    const res = await apiSend<VacationBlock>('PUT', `/vacation-blocks/${encodeURIComponent(b.id)}`, { ...b, workAreaIds })
    if (!res.ok) setError(res.error)
    else await load()
    setLoading(false)
  }

  const archive = async (b: VacationBlock) => {
    if (!canEdit || !stationId) return
    if (!window.confirm(`„${b.title}“ archivieren (deaktivieren)?`)) return
    setLoading(true)
    const res = await apiSend<VacationBlock>('PUT', `/vacation-blocks/${encodeURIComponent(b.id)}`, { ...b, active: false })
    if (!res.ok) setError(res.error)
    else await load()
    setLoading(false)
  }

  const sorted = useMemo(() => [...items].sort((a, b) => a.startDate.localeCompare(b.startDate)), [items])

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Urlaubssperren</h1>
        <p className="text-sm text-[var(--text-muted)]">Keine Berechtigung (absences.view).</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-16">
      <PageHeader
        title="Urlaubssperren"
        description="Zeiträume ohne Urlaub · leere Arbeitsbereich-Auswahl = gesamte Station · Hinweis erscheint bei bezahltem Urlaubsantrag"
      />
      {error ? <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {canEdit ? (
        <Button type="button" onClick={() => void create()}>
          Urlaubssperre anlegen
        </Button>
      ) : null}
      <div className="space-y-3">
        {loading && !sorted.length ? <p className="text-sm text-[var(--text-muted)]">Lade …</p> : null}
        {!loading && sorted.length === 0 ? (
          <Card padding="md" className="border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">Noch keine Urlaubssperren.</p>
            {canEdit ? (
              <Button type="button" className="mt-3" onClick={() => void create()}>
                Erste Urlaubssperre anlegen
              </Button>
            ) : null}
          </Card>
        ) : null}
        {sorted.map((b) => (
          <Card key={b.id} padding="md" className="border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[var(--text-main)]">{b.title}</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {b.startDate} – {b.endDate}
                </p>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  Arbeitsbereiche: {b.workAreaIds.length ? b.workAreaIds.join(', ') : 'alle'}
                </p>
                <p className="text-xs">{b.active ? <span className="text-emerald-200/90">aktiv</span> : <span className="text-amber-200/90">archiviert</span>}</p>
              </div>
              {canEdit && b.active ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void setAreas(b)}>
                    Bereiche
                  </Button>
                  <Button type="button" variant="ghost" className="text-amber-100/90" onClick={() => void archive(b)}>
                    Archivieren
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
