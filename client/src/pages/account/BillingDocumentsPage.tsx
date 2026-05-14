import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiGetBlob, apiSend, apiUploadMultipart } from '../../services/api'

type DocRow = Record<string, unknown>

const CATEGORIES = ['Vertrag', 'Leistungsnachweis', 'Rechnungsvorlage', 'SEPA / Zahlungsdaten', 'Steuerunterlagen', 'Sonstiges']

export function BillingDocumentsPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const canView = Boolean(user?.globalAdmin || hasPermission('settings.view'))
  const canEdit = Boolean(user?.globalAdmin || hasPermission('settings.edit'))
  const [items, setItems] = useState<DocRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0]!)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    const res = await apiGet<DocRow[]>('/station-hub/billing-documents', { stationId })
    if (!res.ok) {
      setErr(res.error)
      setItems([])
    } else setItems(Array.isArray(res.data) ? res.data : [])
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  const upload = async () => {
    if (!canEdit || !stationId) return
    const f = fileRef.current?.files?.[0]
    if (!f) {
      setErr('Bitte eine Datei wählen.')
      return
    }
    const form = new FormData()
    form.set('title', title.trim() || f.name)
    form.set('category', category)
    form.set('file', f)
    const res = await apiUploadMultipart('/station-hub/billing-documents/upload', form, { stationId })
    if (!res.ok) setErr(res.error)
    else {
      setErr(null)
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      await load()
    }
  }

  const download = async (id: string, fileName: string) => {
    if (!stationId) return
    const res = await apiGetBlob(`/station-hub/billing-documents/${encodeURIComponent(id)}/file`, { stationId })
    if (!res.ok) {
      setErr(res.error)
      return
    }
    const url = URL.createObjectURL(res.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'unterlage'
    a.click()
    URL.revokeObjectURL(url)
  }

  const archive = async (id: string) => {
    if (!canEdit || !stationId) return
    if (!window.confirm('Unterlage archivieren?')) return
    const res = await apiSend('POST', `/station-hub/billing-documents/${encodeURIComponent(id)}/archive`, {}, { stationId })
    if (!res.ok) setErr(res.error)
    else await load()
  }

  if (!canView) return <div className="p-6 text-sm text-[var(--text-muted)]">Keine Berechtigung.</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-16">
      <PageHeader title="Abrechnungsunterlagen" description="Verträge, Nachweise und Zahlungsdokumente (stationsbezogen)" />
      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}

      {canEdit ? (
        <Card padding="md" className="border-[var(--border-subtle)] space-y-3">
          <p className="text-sm font-medium text-[var(--text-main)]">Unterlage hochladen</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-[var(--text-muted)]">
              Titel
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. Rahmenvertrag 2026"
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[var(--text-main)]"
              />
            </label>
            <label className="block text-xs text-[var(--text-muted)]">
              Kategorie
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[var(--text-main)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input ref={fileRef} type="file" className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[var(--text-main)]" />
          <Button type="button" onClick={() => void upload()}>
            Hochladen
          </Button>
        </Card>
      ) : null}

      <Button type="button" variant="outline" onClick={() => void load()}>
        Aktualisieren
      </Button>

      {items.length === 0 ? (
        <Card padding="lg" className="border-[var(--border-subtle)]">
          <p className="text-[var(--text-muted)]">Noch keine Abrechnungsunterlagen.</p>
          {canEdit ? <p className="mt-2 text-sm text-[var(--text-faint)]">Erste Unterlage mit dem Formular oben anlegen.</p> : null}
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const id = String(r.id ?? '')
            const fn = String(r.file_name ?? 'download')
            return (
              <Card key={id} padding="md" className="border-[var(--border-subtle)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-[var(--text-main)]">{String(r.title ?? '')}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {String(r.category ?? '—')} · {String(r.created_at ?? '').slice(0, 10)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => void download(id, fn)}>
                    Herunterladen
                  </Button>
                  {canEdit ? (
                    <Button type="button" variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => void archive(id)}>
                      Archivieren
                    </Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
