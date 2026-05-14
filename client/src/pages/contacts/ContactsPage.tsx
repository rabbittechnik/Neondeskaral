import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'

type Row = Record<string, unknown>

export function ContactsPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const ok = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))
  const [items, setItems] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !ok) return
    const res = await apiGet<Row[]>('/station-hub/contacts', { stationId })
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
    const name = window.prompt('Name?')
    if (!name?.trim()) return
    const res = await apiSend<Row>('POST', '/station-hub/contacts', { name: name.trim(), category: 'sonstiges' }, { stationId })
    if (!res.ok) setErr(res.error)
    else await load()
  }

  if (!ok) return <div className="p-6 text-sm text-[var(--text-muted)]">Keine Berechtigung.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-16">
      <PageHeader title="Kontakte" description="Stationskontakte" />
      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}
      {canEdit ? (
        <Button type="button" onClick={() => void add()}>
          Kontakt hinzufügen
        </Button>
      ) : null}
      <div className="space-y-2">
        {items.length === 0 ? (
          <Card padding="md" className="border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">Noch keine Kontakte.</p>
          </Card>
        ) : (
          items.map((r) => (
            <Card key={String(r.id)} padding="md" className="border-[var(--border-subtle)]">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">{String(r.name ?? '')}</p>
                  <p className="text-xs text-[var(--text-muted)]">{String(r.company ?? '')}</p>
                </div>
                <p className="text-xs text-[var(--text-faint)]">{String(r.category ?? '')}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
