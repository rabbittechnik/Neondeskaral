import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStation } from '../../context/station-context'
import { apiGet } from '../../services/api'
import { Card } from '../ui/Card'
import type { StationDocumentApi } from '../../pages/documents/documentConstants'
import { documentTypeLabel } from '../../pages/documents/documentConstants'

export function EmployeeProfileDocumentsSection({ employeeId }: { employeeId: string }) {
  const { stationId, hasPermission } = useStation()
  const canView = hasPermission('documents.view')
  const [loading, setLoading] = useState(false)
  const [docs, setDocs] = useState<StationDocumentApi[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView || !employeeId) return
    setLoading(true)
    setErr(null)
    const res = await apiGet<{ documents: StationDocumentApi[] }>('/documents', {
      stationId,
      linkedEmployeeId: employeeId,
    })
    setLoading(false)
    if (!res.ok) {
      setErr(res.error)
      setDocs([])
      return
    }
    setDocs(res.data.documents)
  }, [stationId, canView, employeeId])

  useEffect(() => {
    void load()
  }, [load])

  if (!canView) {
    return (
      <Card padding="md" className="border-[var(--border-subtle)]">
        <p className="text-sm text-[var(--text-muted)]">
          Keine Berechtigung für die Dokumentenübersicht (<span className="font-mono">documents.view</span>).
        </p>
      </Card>
    )
  }

  return (
    <Card padding="md" className="border-[var(--border-subtle)]">
      <h2 className="text-sm font-semibold text-[var(--text-main)]">Verknüpfte Dokumente</h2>
      <p className="mt-1 text-xs text-[var(--text-faint)]">
        Aus der Stationsbibliothek verknüpft. Weitere Vorlagen unter Organisation → Dokumente.
      </p>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade…
        </div>
      ) : err ? (
        <p className="mt-3 text-sm text-rose-300/90">{err}</p>
      ) : docs.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">Noch keine Dokumente mit diesem Profil verknüpft.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-black/20 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-cyan-300/80" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--text-main)]">{d.title}</div>
                  <div className="truncate text-xs text-[var(--text-muted)]">{documentTypeLabel(d.documentType)}</div>
                </div>
              </div>
              <Link to="/documents" className="shrink-0 text-xs font-medium text-cyan-300/90 hover:underline">
                Zur Bibliothek
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
