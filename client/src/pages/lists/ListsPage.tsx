import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'

type Row = Record<string, unknown>

export function ListsPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const ok = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))
  const [items, setItems] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !ok) return
    const res = await apiGet<Row[]>('/station-hub/lists', { stationId })
    if (!res.ok) {
      setErr(res.error)
      setItems([])
    } else setItems(Array.isArray(res.data) ? res.data : [])
  }, [stationId, ok])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    if (!canEdit || !stationId) return
    const title = window.prompt('Listentitel?')
    if (!title?.trim()) return
    const res = await apiSend<Row>('POST', '/station-hub/lists', { title: title.trim(), category: 'allgemein' }, { stationId })
    if (!res.ok) setErr(res.error)
    else await load()
  }

  if (!ok) return <div className="p-6 text-sm text-[var(--text-muted)]">Keine Berechtigung.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-16">
      <PageHeader title="Listen" description="Stationslisten mit Punkten (API: station-hub)" />
      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}
      {canEdit ? (
        <Button type="button" onClick={() => void add()}>
          Neue Liste
        </Button>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.length === 0 ? (
          <Card padding="md" className="border-[var(--border-subtle)] sm:col-span-2">
            <p className="text-sm text-[var(--text-muted)]">Noch keine Listen.</p>
          </Card>
        ) : (
          items.map((r) => (
            <Card key={String(r.id)} padding="md" className="border-[var(--border-subtle)]">
              <h3 className="font-semibold text-[var(--text-main)]">{String(r.title ?? '')}</h3>
              <p className="text-xs text-[var(--text-faint)]">{String(r.category ?? '')}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
