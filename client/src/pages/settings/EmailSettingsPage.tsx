import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'

const KEYS = [
  { k: 'day_close', label: 'Tagesabschluss' },
  { k: 'month_report', label: 'Monatsauswertung' },
  { k: 'vacation_request', label: 'Urlaubsantrag gestellt' },
  { k: 'vacation_decision', label: 'Urlaub genehmigt/abgelehnt' },
  { k: 'sick_notice', label: 'Krankmeldung' },
  { k: 'shift_change', label: 'Schichtänderung' },
  { k: 'open_shifts', label: 'Offene Schichten' },
  { k: 'time_approval', label: 'Zeitfreigabe offen' },
  { k: 'tasks_open', label: 'Aufgaben nicht erledigt' },
  { k: 'tuv_reminder', label: 'TÜV-Erinnerung' },
] as const

type EmailCfg = {
  recipients?: string
  cc?: string
  types?: Record<string, boolean>
}

export function EmailSettingsPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const canView = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))

  const [cfg, setCfg] = useState<EmailCfg>({ recipients: '', cc: '', types: {} })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const res = await apiGet<EmailCfg>(`/stations/${encodeURIComponent(stationId)}/email-notification-settings`)
    if (!res.ok) {
      setError(res.error)
      setCfg({ recipients: '', cc: '', types: {} })
    } else setCfg(typeof res.data === 'object' && res.data ? res.data : {})
    setLoading(false)
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!canEdit || !stationId) return
    setLoading(true)
    setError(null)
    const res = await apiSend<EmailCfg>('PUT', `/stations/${encodeURIComponent(stationId)}/email-notification-settings`, cfg)
    if (!res.ok) setError(res.error)
    else {
      setCfg(res.data)
      setSaved(true)
    }
    setLoading(false)
  }

  const toggle = (k: string, v: boolean) => {
    setCfg((c) => ({ ...c, types: { ...c.types, [k]: v } }))
    setSaved(false)
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">E-Mail-Benachrichtigungen</h1>
        <p className="text-sm text-[var(--text-muted)]">Keine Berechtigung.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <PageHeader
        title="E-Mail-Benachrichtigungen"
        description="Empfänger und Schalter pro Kategorie · Versand erfolgt über das konfigurierte Server-SMTP (falls aktiv)."
      />
      {error ? <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-200/90">Gespeichert.</p> : null}

      <Card padding="md" className="border-[var(--border-subtle)] space-y-4">
        <label className="block text-xs text-[var(--text-faint)]">
          Empfänger (kommagetrennt)
          <input
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
            value={cfg.recipients ?? ''}
            disabled={!canEdit}
            onChange={(e) => {
              setCfg((c) => ({ ...c, recipients: e.target.value }))
              setSaved(false)
            }}
          />
        </label>
        <label className="block text-xs text-[var(--text-faint)]">
          CC (optional)
          <input
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
            value={cfg.cc ?? ''}
            disabled={!canEdit}
            onChange={(e) => {
              setCfg((c) => ({ ...c, cc: e.target.value }))
              setSaved(false)
            }}
          />
        </label>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-main)]">Benachrichtigungsarten</p>
          {KEYS.map(({ k, label }) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span>{label}</span>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={cfg.types?.[k] !== false}
                onChange={(e) => toggle(k, e.target.checked)}
              />
            </label>
          ))}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={loading}>
              Speichern
            </Button>
            <Button type="button" variant="outline" disabled>
              Testmail (bald)
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
