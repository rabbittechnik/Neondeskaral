import { useCallback, useEffect, useState } from 'react'
import { Download, Eye, FileText, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { EmployeePayrollDocumentApi } from '../../components/employees/EmployeeProfilePayrollDocumentsSection'
import { employeeAccessGetPayrollBlob, employeeAccessGetQuery } from '../../services/api'

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function formatDeDate(iso: string): string {
  const d = iso?.slice(0, 10)
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return iso || '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function monthYearLabel(doc: EmployeePayrollDocumentApi): string {
  const m = MONTHS[doc.month - 1] ?? String(doc.month)
  return `${m} ${doc.year}`
}

type Props = { accessToken: string }

export function EmployeePayrollTab({ accessToken }: Props) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [docs, setDocs] = useState<EmployeePayrollDocumentApi[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const res = await employeeAccessGetQuery<{ documents: EmployeePayrollDocumentApi[] }>(
      accessToken,
      'payroll-documents',
    )
    setLoading(false)
    if (!res.ok) {
      setErr(res.error ?? 'Lohnabrechnungen konnten nicht geladen werden.')
      setDocs([])
      return
    }
    setDocs(res.data.documents ?? [])
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  const download = async (doc: EmployeePayrollDocumentApi, inline: boolean) => {
    setBusyId(doc.id)
    setErr(null)
    const r = await employeeAccessGetPayrollBlob(accessToken, doc.id, { inline })
    setBusyId(null)
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

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-cyan-100">Lohnabrechnung</h2>
        <p className="mt-2 text-xs text-slate-400">
          Hier findest du nur deine eigenen Lohnabrechnungen. Vertrauliche Dokumente — bitte nicht weitergeben.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Lade…
        </p>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-400">
          Noch keine Lohnabrechnungen hinterlegt.
        </div>
      ) : (
        <ul className="space-y-3">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-[0_0_20px_rgba(34,211,238,0.06)]"
            >
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/90" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-cyan-200/80">{monthYearLabel(doc)}</p>
                  <p className="mt-0.5 font-medium text-white">{doc.title}</p>
                  {doc.note ? <p className="mt-1 text-xs text-slate-400">{doc.note}</p> : null}
                  <p className="mt-2 text-[11px] text-slate-500">Bereitgestellt am {formatDeDate(doc.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1 border-cyan-500/30 text-xs"
                  disabled={busyId === doc.id}
                  onClick={() => void download(doc, true)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  Ansehen
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="gap-1 text-xs"
                  disabled={busyId === doc.id}
                  onClick={() => void download(doc, false)}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {busyId === doc.id ? 'Lädt…' : 'PDF herunterladen'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {err ? <p className="text-sm text-red-300/90">{err}</p> : null}
    </section>
  )
}
