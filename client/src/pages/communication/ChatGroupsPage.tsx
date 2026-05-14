import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'

type Row = Record<string, unknown>

export function ChatGroupsPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const ok = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))
  const [items, setItems] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !ok) return
    const res = await apiGet<Row[]>('/station-hub/chat-groups', { stationId })
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
    const name = window.prompt('Gruppenname?')
    if (!name?.trim()) return
    const res = await apiSend<Row>('POST', '/station-hub/chat-groups', { name: name.trim(), memberEmployeeIds: [] }, { stationId })
    if (!res.ok) setErr(res.error)
    else await load()
  }

  if (!ok) return <div className="p-6 text-sm text-[var(--text-muted)]">Keine Berechtigung.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-16">
      <PageHeader title="Chat-Gruppen" description="Vorbereitung für späteren Live-Chat" />
      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}
      {canEdit ? (
        <Button type="button" onClick={() => void add()}>
          Chat-Gruppe erstellen
        </Button>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.length === 0 ? (
          <Card padding="md" className="border-[var(--border-subtle)] sm:col-span-2">
            <p className="text-sm text-[var(--text-muted)]">Noch keine Gruppen.</p>
          </Card>
        ) : (
          items.map((r) => (
            <Card key={String(r.id)} padding="md" className="border-[var(--border-subtle)]">
              <p className="font-semibold text-[var(--text-main)]">{String(r.name ?? '')}</p>
              <p className="text-xs text-[var(--text-faint)]">Mitglieder: {String(r.member_count ?? 0)}</p>
              <p className="text-xs">{Number(r.active) !== 0 ? <span className="text-emerald-200/80">aktiv</span> : <span className="text-amber-200/80">inaktiv</span>}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
