import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, ExternalLink, FileText, Loader2, Printer } from 'lucide-react'
import { apiGet, apiGetBlob, apiSend } from '../../services/api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import type { StationDocumentApi } from '../../pages/documents/documentConstants'

type TemplateKey = 'schnuppertage' | 'personalbogen_2026' | 'tuv_monatscheckliste'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

type Props = {
  stationId: string
  canEdit: boolean
  canPrint: boolean
  onOpenDocument: (doc: StationDocumentApi) => void
  onMessage: (msg: string | null) => void
  onTuvChecklistFill?: () => void
}

export function DocumentTemplatesSection({
  stationId,
  canEdit,
  canPrint,
  onOpenDocument,
  onMessage,
  onTuvChecklistFill,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<StationDocumentApi[]>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<{ templates: StationDocumentApi[] }>('/documents/templates', { stationId })
    setLoading(false)
    if (!res.ok) {
      onMessage(res.error)
      setTemplates([])
      return
    }
    setTemplates(res.data.templates ?? [])
  }, [stationId, onMessage])

  useEffect(() => {
    void load()
  }, [load])

  const download = async (doc: StationDocumentApi) => {
    const r = await apiGetBlob(`/documents/${encodeURIComponent(doc.id)}/download`, { stationId })
    if (!r.ok) {
      onMessage(r.error)
      return
    }
    const u = URL.createObjectURL(r.blob)
    const a = document.createElement('a')
    a.href = u
    a.download = doc.fileName
    a.click()
    URL.revokeObjectURL(u)
  }

  const print = async (doc: StationDocumentApi) => {
    if (!canPrint) return
    const r = await apiGetBlob(`/documents/${encodeURIComponent(doc.id)}/preview`, { stationId })
    if (!r.ok) {
      onMessage(r.error)
      return
    }
    const u = URL.createObjectURL(r.blob)
    const w = window.open(u, '_blank', 'noopener,noreferrer')
    w?.addEventListener('load', () => {
      try {
        w?.print()
      } catch {
        /* ignore */
      }
    })
  }

  const copyFromTemplate = async (key: TemplateKey, titleSuffix?: string) => {
    if (!canEdit) return
    setBusyKey(key)
    onMessage(null)
    const res = await apiSend<{ document: StationDocumentApi }>(
      'POST',
      `/documents/templates/${key}/copy`,
      titleSuffix ? { titleSuffix } : {},
      { stationId },
    )
    setBusyKey(null)
    if (!res.ok) {
      onMessage(res.error)
      return
    }
    onMessage(`Kopie erstellt: ${res.data.document.title}`)
    onOpenDocument(res.data.document)
  }

  return (
    <Card padding="md" className="border-cyan-500/20">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Vorlagenverwaltung</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Feste Stationsvorlagen. Originale bleiben unverändert – „Neue Kopie“ erzeugt eine ausfüllbare Kopie.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Vorlagen werden geladen…
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className="px-2 py-2 font-medium">Dokument</th>
              <th className="px-2 py-2 font-medium">Kategorie</th>
              <th className="px-2 py-2 font-medium">Stand</th>
              <th className="px-2 py-2 font-medium">Typ</th>
              <th className="px-2 py-2 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((doc) => {
              const key = doc.templateKey ?? ''
              return (
                <tr key={doc.id} className="border-b border-white/5">
                  <td className="px-2 py-3">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/90" aria-hidden />
                      <div>
                        <div className="font-medium text-[var(--text-main)]">{doc.title}</div>
                        <div className="mt-0.5 text-xs text-[var(--text-faint)]">{doc.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-[var(--text-muted)]">{doc.category}</td>
                  <td className="px-2 py-3 text-[var(--text-muted)]">{doc.versionLabel ?? '—'}</td>
                  <td className="px-2 py-3 text-[var(--text-muted)]">PDF · {formatBytes(doc.fileSize)}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" variant="outline" className="gap-1 px-2 py-1 text-xs" onClick={() => onOpenDocument(doc)}>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Öffnen
                      </Button>
                      <Button type="button" variant="outline" className="gap-1 px-2 py-1 text-xs" onClick={() => void download(doc)}>
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Download
                      </Button>
                      {canPrint ? (
                        <Button type="button" variant="outline" className="gap-1 px-2 py-1 text-xs" onClick={() => void print(doc)}>
                          <Printer className="h-3.5 w-3.5" aria-hidden />
                          Drucken
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-1 px-2 py-1 text-xs"
                          disabled={busyKey === key}
                          onClick={() => {
                            if (key === 'tuv_monatscheckliste' && onTuvChecklistFill) {
                              onTuvChecklistFill()
                              return
                            }
                            void copyFromTemplate(key as TemplateKey)
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          {key === 'tuv_monatscheckliste' ? 'Monatscheckliste ausfüllen' : 'Neue Kopie'}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
