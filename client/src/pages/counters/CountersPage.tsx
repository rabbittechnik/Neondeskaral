import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'

type Row = Record<string, unknown>

export function CountersPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const ok = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))
  const [meters, setMeters] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !ok) return
    const res = await apiGet<Row[]>('/station-hub/meters', { stationId })
    if (!res.ok) {
      setErr(res.error)
      setMeters([])
    } else setMeters(Array.isArray(res.data) ? res.data : [])
  }, [stationId, ok])

  useEffect(() => {
    void load()
  }, [load])

  const addMeter = async () => {
    if (!canEdit || !stationId) return
    const name = window.prompt('Zählername?')
    if (!name?.trim()) return
    const unit = window.prompt('Einheit?', 'kWh') ?? 'kWh'
    const res = await apiSend<Row>('POST', '/station-hub/meters', { name: name.trim(), unit, category: 'strom' }, { stationId })
    if (!res.ok) setErr(res.error)
    else await load()
  }

  if (!ok) return <div className="p-6 text-sm text-[var(--text-muted)]">Keine Berechtigung.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-16">
      <PageHeader title="Zählerstände" description="Zähler und Erfassung" />
      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}
      {canEdit ? (
        <Button type="button" onClick={() => void addMeter()}>
          Zähler anlegen
        </Button>
      ) : null}
      <div className="space-y-2">
        {meters.length === 0 ? (
          <Card padding="md" className="border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">Noch keine Zähler.</p>
          </Card>
        ) : (
          meters.map((m) => (
            <Card key={String(m.id)} padding="md" className="border-[var(--border-subtle)]">
              <p className="font-semibold text-[var(--text-main)]">{String(m.name ?? '')}</p>
              <p className="text-xs text-[var(--text-faint)]">
                {String(m.category ?? '')} · {String(m.unit ?? '')}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
