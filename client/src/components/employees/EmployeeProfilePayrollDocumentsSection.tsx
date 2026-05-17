import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useStation } from '../../context/station-context'
import { apiGet, apiGetBlob, apiSend, apiUploadMultipart, apiUploadMultipartMethod } from '../../services/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { inputClass } from '../schedule/shift/fieldStyles'

export type EmployeePayrollDocumentApi = {
  id: string
  stationId: string
  employeeId: string
  year: number
  month: number
  title: string
  originalFilename: string
  mimeType: string
  fileSize: number
  note: string
  uploadedByUserId: string | null
  uploadedByName: string | null
  createdAt: string
  updatedAt: string
}

const MONTHS = [
  { value: 1, label: 'Januar' },
  { value: 2, label: 'Februar' },
  { value: 3, label: 'März' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Dezember' },
]

function formatDeDate(iso: string): string {
  const d = iso?.slice(0, 10)
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return iso || '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

type Props = {
  employeeId: string
  employeeDisplayName: string
}

export function EmployeeProfilePayrollDocumentsSection({ employeeId, employeeDisplayName }: Props) {
  const { stationId, hasPermission } = useStation()
  const canView =
    hasPermission('employeePayrollDocuments.view') ||
    hasPermission('employeePayrollDocuments.manage') ||
    hasPermission('payroll.view') ||
    hasPermission('employees.manageSensitive')
  const canManage =
    hasPermission('employeePayrollDocuments.manage') || hasPermission('employees.manageSensitive')

  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [docs, setDocs] = useState<EmployeePayrollDocumentApi[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [replaceId, setReplaceId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setErr(null)
    const res = await apiGet<{ documents: EmployeePayrollDocumentApi[] }>(
      `/employees/${encodeURIComponent(employeeId)}/payroll-documents`,
      { stationId },
    )
    setLoading(false)
    if (!res.ok) {
      setErr(res.error)
      setDocs([])
      return
    }
    setDocs(res.data.documents ?? [])
  }, [stationId, canView, employeeId])

  useEffect(() => {
    void load()
  }, [load])

  const download = async (doc: EmployeePayrollDocumentApi, inline: boolean) => {
    if (!stationId) return
    const r = await apiGetBlob(
      `/employees/${encodeURIComponent(employeeId)}/payroll-documents/${encodeURIComponent(doc.id)}/download`,
      { stationId, inline: inline ? '1' : undefined },
    )
    if (!r.ok) {
      setErr(r.error)
      return
    }
    const u = URL.createObjectURL(r.blob)
    if (inline) {
      window.open(u, '_blank', 'noopener,noreferrer')
    } else {
      const a = document.createElement('a')
      a.href = u
      a.download = doc.originalFilename || 'lohnabrechnung.pdf'
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(u), 60_000)
  }

  const upload = async () => {
    if (!stationId || !canManage || !file) return
    setUploading(true)
    setErr(null)
    const fd = new FormData()
    fd.set('stationId', stationId)
    fd.set('year', String(year))
    fd.set('month', String(month))
    if (note.trim()) fd.set('note', note.trim())
    fd.set('file', file)

    const res = replaceId
      ? await apiUploadMultipartMethod<{ document: EmployeePayrollDocumentApi }>(
          'PUT',
          `/employees/${encodeURIComponent(employeeId)}/payroll-documents/${encodeURIComponent(replaceId)}`,
          fd,
        )
      : await apiUploadMultipart<{ document: EmployeePayrollDocumentApi }>(
          `/employees/${encodeURIComponent(employeeId)}/payroll-documents`,
          fd,
        )

    setUploading(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setFile(null)
    setNote('')
    setReplaceId(null)
    void load()
  }

  const remove = async (doc: EmployeePayrollDocumentApi) => {
    if (!stationId || !canManage) return
    const monthLabel = MONTHS.find((m) => m.value === doc.month)?.label ?? String(doc.month)
    if (
      !window.confirm(
        `Lohnabrechnung ${monthLabel} ${doc.year} für ${employeeDisplayName} wirklich löschen?`,
      )
    ) {
      return
    }
    const res = await apiSendDelete(stationId, employeeId, doc.id)
    if (!res.ok) setErr(res.error)
    else void load()
  }

  if (!canView) {
    return (
      <Card padding="md" className="border-[var(--border-subtle)]">
        <p className="text-sm text-[var(--text-muted)]">
          Keine Berechtigung für Lohnabrechnungen (
          <span className="font-mono">employeePayrollDocuments.view</span>).
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card padding="md" className="border-cyan-500/20">
          <h2 className="text-sm font-semibold text-[var(--text-main)]">Lohnabrechnung hochladen</h2>
          <p className="mt-1 text-sm font-medium text-cyan-200/90">
            Lohnabrechnung wird gespeichert für: {employeeDisplayName}
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Lohnabrechnungen sind vertrauliche Dokumente. Zugriff nur für berechtigte Leitung und den jeweiligen
            Mitarbeiter.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Jahr</span>
              <input
                type="number"
                className={inputClass}
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Monat</span>
              <select className={inputClass} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">Notiz (optional)</span>
              <input
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. Korrekturabrechnung, Nachgereicht"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">PDF-Datei</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="text-sm text-[var(--text-muted)]"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {replaceId ? (
            <p className="mt-2 text-xs text-amber-200/90">Ersetzt bestehende Abrechnung (PDF wird überschrieben).</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="primary" disabled={uploading || !file} onClick={() => void upload()}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Speichern…' : replaceId ? 'PDF ersetzen' : 'PDF hochladen'}
            </Button>
            {replaceId ? (
              <Button type="button" variant="outline" onClick={() => setReplaceId(null)}>
                Abbrechen (Ersetzen)
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card padding="md" className="border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--text-main)]">Gespeicherte Lohnabrechnungen</h2>
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade…
          </p>
        ) : docs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Noch keine Lohnabrechnungen hinterlegt.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/90" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text-main)]">{doc.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {doc.originalFilename} · {formatBytes(doc.fileSize)}
                    </div>
                    {doc.note ? <div className="mt-1 text-xs text-[var(--text-faint)]">{doc.note}</div> : null}
                    <div className="mt-1 text-[10px] text-[var(--text-faint)]">
                      Hochgeladen {formatDeDate(doc.createdAt)}
                      {doc.uploadedByName ? ` von ${doc.uploadedByName}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" className="gap-1 px-2 py-1 text-xs" onClick={() => void download(doc, true)}>
                    <Eye className="h-3.5 w-3.5" />
                    Ansehen
                  </Button>
                  <Button type="button" variant="outline" className="gap-1 px-2 py-1 text-xs" onClick={() => void download(doc, false)}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  {canManage ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="px-2 py-1 text-xs"
                        onClick={() => {
                          setReplaceId(doc.id)
                          setYear(doc.year)
                          setMonth(doc.month)
                          setNote(doc.note)
                        }}
                      >
                        Ersetzen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1 px-2 py-1 text-xs text-red-200/90"
                        onClick={() => void remove(doc)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Löschen
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}
    </div>
  )
}

async function apiSendDelete(stationId: string, employeeId: string, documentId: string) {
  return apiSend<{ deleted: boolean }>(
    'DELETE',
    `/employees/${encodeURIComponent(employeeId)}/payroll-documents/${encodeURIComponent(documentId)}`,
    undefined,
    { stationId },
  )
}

