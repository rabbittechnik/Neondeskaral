import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Download,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Pencil,
  Printer,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStation } from '../../context/station-context'
import { useEmployees } from '../../context/employees-context'
import { apiGet, apiGetBlob, apiSend, apiUploadMultipart, apiUploadMultipartMethod } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmployeeModal } from '../../components/employees/EmployeeModal'
import { DOCUMENT_CATEGORIES, DOCUMENT_TYPES, documentTypeLabel, type StationDocumentApi } from './documentConstants'
import { inputClass } from '../../components/schedule/shift/fieldStyles'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDeDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return iso
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function DocThumb({ mime }: { mime: string }) {
  if (mime === 'application/pdf') {
    return <FileText className="h-12 w-12 text-rose-300/90 drop-shadow-[0_0_12px_rgba(251,113,133,0.35)]" />
  }
  if (mime.startsWith('image/')) {
    return <ImageIcon className="h-12 w-12 text-cyan-300/90 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]" />
  }
  return <FileText className="h-12 w-12 text-[var(--text-muted)]" />
}

export function DocumentsPage() {
  const { stationId, hasPermission } = useStation()
  const { employees, addEmployee } = useEmployees()
  const canView = hasPermission('documents.view')
  const canUpload = hasPermission('documents.upload')
  const canEdit = hasPermission('documents.edit')
  const canArchive = hasPermission('documents.archive')
  const canPrint = hasPermission('documents.print') || canView
  const canCreateEmpFromDoc =
    hasPermission('documents.create_employee_from_document') && hasPermission('employees.create')

  const [loading, setLoading] = useState(false)
  const [docs, setDocs] = useState<StationDocumentApi[]>([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState<StationDocumentApi | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [personalFlowDoc, setPersonalFlowDoc] = useState<StationDocumentApi | null>(null)
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [linkEmployeeId, setLinkEmployeeId] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setMsg(null)
    const res = await apiGet<{ documents: StationDocumentApi[] }>('/documents', {
      stationId,
      q: q.trim() || undefined,
      category: category || undefined,
      includeArchived: showArchived ? '1' : undefined,
    })
    setLoading(false)
    if (!res.ok) {
      setMsg(res.error)
      setDocs([])
      return
    }
    setDocs(res.data.documents)
  }, [stationId, canView, q, category, showArchived])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (d: StationDocumentApi, skipPersonalDialog?: boolean) => {
    setMsg(null)
    if (d.documentType === 'personal_form' && !skipPersonalDialog) {
      setPersonalFlowDoc(d)
      return
    }
    setSelected(d)
    setPreviewUrl(null)
    const blobRes = await apiGetBlob(`/documents/${encodeURIComponent(d.id)}/preview`, { stationId: stationId! })
    if (blobRes.ok) {
      const u = URL.createObjectURL(blobRes.blob)
      setPreviewUrl(u)
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const closeDetail = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setSelected(null)
  }

  const downloadSelected = async () => {
    if (!selected || !stationId) return
    const r = await apiGetBlob(`/documents/${encodeURIComponent(selected.id)}/download`, { stationId })
    if (!r.ok) {
      setMsg(r.error)
      return
    }
    const u = URL.createObjectURL(r.blob)
    const a = document.createElement('a')
    a.href = u
    a.download = selected.fileName
    a.click()
    URL.revokeObjectURL(u)
  }

  const printSelected = async () => {
    if (!selected || !stationId || !canPrint) return
    const r = await apiGetBlob(`/documents/${encodeURIComponent(selected.id)}/preview`, { stationId })
    if (!r.ok) {
      setMsg(r.error)
      return
    }
    const u = URL.createObjectURL(r.blob)
    const w = window.open(u, '_blank', 'noopener,noreferrer')
    if (w) {
      w.addEventListener('load', () => {
        try {
          w.print()
        } catch {
          /* ignore */
        }
      })
    }
  }

  const archiveDoc = async (d: StationDocumentApi) => {
    if (!stationId) return
    if (!window.confirm('Dokument wirklich archivieren? Es verschwindet aus der normalen Liste.')) return
    const res = await apiSend<{ document: StationDocumentApi }>(
      'POST',
      `/documents/${encodeURIComponent(d.id)}/archive`,
      { stationId },
    )
    if (!res.ok) setMsg(res.error)
    else void load()
    if (selected?.id === d.id) closeDetail()
  }

  const linkEmployee = async () => {
    if (!selected || !stationId || !linkEmployeeId.trim()) return
    const res = await apiSend<{ linkedEmployeeIds: string[] }>(
      'POST',
      `/documents/${encodeURIComponent(selected.id)}/link-employee`,
      { stationId, employeeId: linkEmployeeId.trim() },
    )
    if (!res.ok) setMsg(res.error)
    else {
      setMsg('Mit Mitarbeiter verknüpft.')
      setSelected((s) => (s ? { ...s, linkedEmployeeIds: res.data?.linkedEmployeeIds ?? s.linkedEmployeeIds } : s))
      void load()
    }
  }

  const empOptions = useMemo(() => employees.filter((e) => Boolean(e.id)), [employees])

  if (!stationId) {
    return <p className="text-sm text-[var(--text-muted)]">Bitte zuerst eine Station wählen.</p>
  }

  if (!canView) {
    return (
      <Card padding="lg" className="border border-amber-500/25 bg-amber-500/5">
        <p className="text-sm text-[var(--text-main)]">
          Keine Berechtigung für Stationsdokumente. Erforderlich:{' '}
          <span className="font-mono text-cyan-200/90">documents.view</span>
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Dokumente</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Wichtige Formulare, Vorlagen und Dokumente der Station.
        </p>
      </header>

      {msg ? (
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100/90">
          {msg}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="search"
              placeholder="Dokument suchen…"
              className={`${inputClass} pl-9`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Suche"
            />
          </div>
          <select
            className={`${inputClass} max-w-full sm:w-56`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Kategorie"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value || 'all'} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] whitespace-nowrap">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-[var(--border-strong)]"
            />
            Archivierte anzeigen
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpload ? (
            <Button type="button" variant="primary" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Dokument hochladen
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lade Dokumente…
        </div>
      ) : docs.length === 0 ? (
        <Card
          padding="lg"
          className="border border-dashed border-cyan-500/25 bg-[var(--bg-elevated)]/40 text-center"
        >
          <p className="text-sm text-[var(--text-muted)]">Noch keine Dokumente vorhanden.</p>
          {canUpload ? (
            <Button type="button" variant="outline" className="mt-4" onClick={() => setUploadOpen(true)}>
              Erstes Dokument hochladen
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => void openDetail(d)}
              className="group flex flex-col rounded-[var(--radius-md)] border border-cyan-500/20 bg-[var(--bg-card)]/90 p-4 text-left shadow-[0_0_0_1px_rgba(34,211,238,0.06)] transition hover:border-cyan-400/45 hover:shadow-[0_0_28px_rgba(34,211,238,0.12)]"
            >
              <div className="flex flex-1 items-center justify-center rounded-[var(--radius-sm)] bg-black/30 py-8 ring-1 ring-white/5">
                <DocThumb mime={d.mimeType} />
              </div>
              <div className="mt-3 min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--text-main)]">{d.title}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                  {d.category || '—'} · {documentTypeLabel(d.documentType)}
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-faint)]">
                  {d.mimeType.split('/').pop()} · {formatBytes(d.fileSize)} · {formatDeDate(d.updatedAt)}
                </div>
                {d.archivedAt ? (
                  <span className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-100/90">
                    Archiviert
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {personalFlowDoc ? (
        <PersonalbogenChoiceModal
          doc={personalFlowDoc}
          canCreateEmployee={canCreateEmpFromDoc}
          onClose={() => setPersonalFlowDoc(null)}
          onOpenOnly={() => {
            const d = personalFlowDoc
            setPersonalFlowDoc(null)
            void openDetail(d, true)
          }}
          onFillLater={() => {
            setMsg('Ausfüllbare PDF-Formularfelder sind für eine spätere Phase vorgesehen (Struktur bleibt erhalten).')
            setPersonalFlowDoc(null)
          }}
          onCreateEmployee={() => {
            setSelected(personalFlowDoc)
            setPersonalFlowDoc(null)
            setEmployeeModalOpen(true)
          }}
        />
      ) : null}

      {employeeModalOpen && selected ? (
        <EmployeeModal
          open={employeeModalOpen}
          mode="create"
          employee={null}
          createSeed={{}}
          onClose={() => {
            setEmployeeModalOpen(false)
            setSelected(null)
          }}
          onSaveCreate={async (e) => {
            await addEmployee(e)
            const docId = selected.id
            const link = await apiSend<{ linkedEmployeeIds: string[] }>(
              'POST',
              `/documents/${encodeURIComponent(docId)}/link-employee`,
              { stationId: stationId!, employeeId: e.id },
            )
            if (!link.ok) throw new Error(link.error)
            setEmployeeModalOpen(false)
            setSelected(null)
            void load()
          }}
          onSaveEdit={async () => {}}
        />
      ) : null}

      {uploadOpen ? (
        <DocumentUploadModal
          stationId={stationId}
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            setUploadOpen(false)
            void load()
          }}
        />
      ) : null}

      {editOpen && selected ? (
        <DocumentEditModal
          stationId={stationId}
          doc={selected}
          onClose={() => setEditOpen(false)}
          onDone={() => {
            setEditOpen(false)
            void load()
          }}
        />
      ) : null}

      {selected && !employeeModalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetail()
          }}
        >
          <Card
            padding="none"
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border border-cyan-500/30 bg-[var(--bg-card)] shadow-[0_0_40px_rgba(34,211,238,0.15)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-[var(--text-main)]">{selected.title}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {selected.category || '—'} · {documentTypeLabel(selected.documentType)}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-main)]"
                onClick={closeDetail}
                aria-label="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-[50vh] flex-1 overflow-auto bg-black/40 p-2">
              {previewUrl && selected.mimeType === 'application/pdf' ? (
                <iframe title="Vorschau" src={previewUrl} className="h-[60vh] w-full rounded border border-white/10" />
              ) : previewUrl && selected.mimeType.startsWith('image/') ? (
                <img src={previewUrl} alt="" className="mx-auto max-h-[65vh] max-w-full object-contain" />
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                  <DocThumb mime={selected.mimeType} />
                  <p className="text-sm">Vorschau nicht verfügbar. Bitte herunterladen.</p>
                </div>
              )}
            </div>
            {selected.description ? (
              <p className="border-t border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-muted)]">
                {selected.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
              <Button type="button" variant="outline" onClick={closeDetail}>
                Zurück
              </Button>
              {canPrint ? (
                <Button type="button" variant="outline" onClick={() => void printSelected()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Drucken
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => void downloadSelected()}>
                <Download className="mr-2 h-4 w-4" />
                Herunterladen
              </Button>
              {canEdit ? (
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </Button>
              ) : null}
              {canArchive && !selected.archivedAt ? (
                <Button type="button" variant="outline" onClick={() => void archiveDoc(selected)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivieren
                </Button>
              ) : null}
            </div>
            {canEdit ? (
              <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                <p className="mb-2 text-xs font-medium text-[var(--text-faint)]">Mit Mitarbeiter verknüpfen</p>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={`${inputClass} min-w-[12rem] flex-1`}
                    value={linkEmployeeId}
                    onChange={(e) => setLinkEmployeeId(e.target.value)}
                  >
                    <option value="">Mitarbeiter wählen…</option>
                    {empOptions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.displayName}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="primary" disabled={!linkEmployeeId.trim()} onClick={() => void linkEmployee()}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Verknüpfen
                  </Button>
                </div>
                {selected.linkedEmployeeIds.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                    {selected.linkedEmployeeIds.map((id) => {
                      const em = employees.find((x) => x.id === id)
                      return (
                        <li key={id}>
                          <Link to={`/employees/${id}`} className="text-cyan-300/90 hover:underline">
                            {em?.displayName ?? id}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  )
}

function PersonalbogenChoiceModal({
  doc,
  canCreateEmployee,
  onClose,
  onOpenOnly,
  onFillLater,
  onCreateEmployee,
}: {
  doc: StationDocumentApi
  canCreateEmployee: boolean
  onClose: () => void
  onOpenOnly: () => void
  onFillLater: () => void
  onCreateEmployee: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Card padding="lg" className="max-w-md border border-fuchsia-500/25 shadow-[0_0_32px_rgba(217,70,239,0.12)]">
        <h3 className="text-base font-semibold text-[var(--text-main)]">Personalbogen</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Was möchtest du mit „{doc.title}“ machen?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" variant="outline" onClick={onOpenOnly}>
            Nur öffnen / drucken
          </Button>
          <Button type="button" variant="outline" onClick={onFillLater}>
            Personalbogen ausfüllen (vorbereitet, später)
          </Button>
          {canCreateEmployee ? (
            <Button type="button" variant="primary" onClick={onCreateEmployee}>
              Neuen Mitarbeiter aus Personalbogen anlegen
            </Button>
          ) : (
            <p className="text-xs text-[var(--text-faint)]">
              Neu anlegen: Berechtigungen <span className="font-mono">employees.create</span> und{' '}
              <span className="font-mono">documents.create_employee_from_document</span> erforderlich.
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" className="mt-3 w-full text-[var(--text-muted)]" onClick={onClose}>
          Abbrechen
        </Button>
      </Card>
    </div>
  )
}

function DocumentUploadModal({
  stationId,
  onClose,
  onDone,
}: {
  stationId: string
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Personal')
  const [documentType, setDocumentType] = useState('other')
  const [description, setDescription] = useState('')
  const [globalDocument, setGlobalDocument] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    if (!title.trim()) {
      setErr('Titel erforderlich.')
      return
    }
    if (!file) {
      setErr('Bitte eine Datei wählen.')
      return
    }
    const fd = new FormData()
    fd.set('stationId', stationId)
    fd.set('title', title.trim())
    fd.set('category', category)
    fd.set('documentType', documentType)
    fd.set('description', description)
    if (globalDocument) fd.set('globalDocument', '1')
    fd.set('file', file)
    setBusy(true)
    const res = await apiUploadMultipart<{ document: StationDocumentApi }>('/documents/upload', fd)
    setBusy(false)
    if (!res.ok) setErr(res.error)
    else onDone()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Card padding="lg" className="max-h-[90vh] w-[min(95vw,960px)] max-w-[min(95vw,960px)] overflow-y-auto border border-cyan-500/25">
        <h3 className="text-lg font-semibold text-[var(--text-main)]">Dokument hochladen</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-[var(--text-faint)]">Titel</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="block text-xs text-[var(--text-faint)]">Kategorie</label>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.filter((c) => c.value).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="block text-xs text-[var(--text-faint)]">Dokumenttyp</label>
          <select className={inputClass} value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="block text-xs text-[var(--text-faint)]">Beschreibung (optional)</label>
          <textarea className={`${inputClass} min-h-[4rem]`} value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input type="checkbox" checked={globalDocument} onChange={(e) => setGlobalDocument(e.target.checked)} />
            Für alle Stationen sichtbar (global)
          </label>
          <label className="block text-xs text-[var(--text-faint)]">Datei (PDF, PNG, JPG, DOCX)</label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-[var(--text-muted)]" />
          {err ? <p className="text-sm text-rose-300/90">{err}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="button" variant="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Speichern…' : 'Hochladen'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function DocumentEditModal({
  stationId,
  doc,
  onClose,
  onDone,
}: {
  stationId: string
  doc: StationDocumentApi
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState(doc.title)
  const [category, setCategory] = useState(doc.category || '')
  const [documentType, setDocumentType] = useState(doc.documentType)
  const [description, setDescription] = useState(doc.description || '')
  const [globalDocument, setGlobalDocument] = useState(doc.globalDocument)
  const [active, setActive] = useState(doc.active)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    const fd = new FormData()
    fd.set('stationId', stationId)
    fd.set('title', title.trim())
    fd.set('category', category)
    fd.set('documentType', documentType)
    fd.set('description', description)
    fd.set('globalDocument', globalDocument ? '1' : '0')
    fd.set('active', active ? '1' : '0')
    if (file) fd.set('file', file)
    setBusy(true)
    const res = await apiUploadMultipartMethod<{ document: StationDocumentApi }>(
      'PUT',
      `/documents/${encodeURIComponent(doc.id)}`,
      fd,
    )
    setBusy(false)
    if (!res.ok) setErr(res.error)
    else onDone()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Card padding="lg" className="max-h-[90vh] w-[min(95vw,960px)] max-w-[min(95vw,960px)] overflow-y-auto border border-cyan-500/25">
        <h3 className="text-lg font-semibold text-[var(--text-main)]">Dokument bearbeiten</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-[var(--text-faint)]">Titel</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="block text-xs text-[var(--text-faint)]">Kategorie</label>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOCUMENT_CATEGORIES.filter((c) => c.value).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="block text-xs text-[var(--text-faint)]">Dokumenttyp</label>
          <select className={inputClass} value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="block text-xs text-[var(--text-faint)]">Beschreibung</label>
          <textarea className={`${inputClass} min-h-[4rem]`} value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input type="checkbox" checked={globalDocument} onChange={(e) => setGlobalDocument(e.target.checked)} />
            Global (alle Stationen)
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Aktiv
          </label>
          <label className="block text-xs text-[var(--text-faint)]">Datei ersetzen (optional)</label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-[var(--text-muted)]" />
          {err ? <p className="text-sm text-rose-300/90">{err}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="button" variant="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
