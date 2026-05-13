import { useCallback, useEffect, useMemo, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { ABSENCE_STATUS_LABELS } from '../../components/absences/absenceLabels'
import { Button } from '../../components/ui/Button'
import { employeeAccessGetQuery, employeeAccessPostJson } from '../../services/api'
import { formatDateDE, formatDateTimeDE } from '../../utils/dateFormat'
import type { Absence } from '../../types/absence'
import type { EmployeeAbsenceRow } from './EmployeeUrlaubTab'

const CERT_OPTIONS: { value: string; label: string }[] = [
  { value: 'upload', label: 'Foto hochladen' },
  { value: 'camera', label: 'Foto mit Kamera aufnehmen' },
  { value: 'digital_doctor', label: 'Krankschreibung kommt digital vom Arzt' },
  { value: 'will_follow', label: 'Krankschreibung wird nachgereicht' },
]

function certLabel(source?: string): string {
  const s = String(source ?? '').trim()
  const o = CERT_OPTIONS.find((x) => x.value === s)
  if (o) return o.label
  if (s === 'digital_doctor') return 'Digital vom Arzt'
  if (s === 'will_follow') return 'Wird nachgereicht'
  if (s === 'upload') return 'Foto hochgeladen'
  if (s === 'camera') return 'Foto (Kamera)'
  return s || '—'
}

function statusPresentation(status: string): { label: string; className: string } {
  const label = ABSENCE_STATUS_LABELS[status as keyof typeof ABSENCE_STATUS_LABELS] ?? status
  if (status === 'beantragt')
    return { label, className: 'border-amber-400/40 bg-amber-500/15 text-amber-100' }
  if (status === 'genehmigt' || status === 'erfasst')
    return { label, className: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' }
  if (status === 'abgelehnt')
    return { label, className: 'border-rose-400/45 bg-rose-500/15 text-rose-100' }
  if (status === 'storniert')
    return { label, className: 'border-white/15 bg-white/5 text-slate-400' }
  return { label, className: 'border-white/10 bg-white/5 text-slate-300' }
}

type Props = {
  accessToken: string
  /** Optional: Liste aus Haupt-Payload; wird mit GET sick-reports ergänzt/aktualisiert */
  initialSick?: EmployeeAbsenceRow[]
  onReload: () => Promise<void>
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const res = String(r.result ?? '')
      const i = res.indexOf(',')
      resolve(i >= 0 ? res.slice(i + 1) : res)
    }
    r.onerror = () => reject(new Error('read_failed'))
    r.readAsDataURL(file)
  })
}

export function EmployeeKrankTab({ accessToken, initialSick, onReload }: Props) {
  const [list, setList] = useState<EmployeeAbsenceRow[]>(() =>
    (initialSick ?? []).filter((a) => a.type === 'sick' || a.type === 'child_sick'),
  )
  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<'sick' | 'child_sick'>('sick')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [comment, setComment] = useState('')
  const [certSource, setCertSource] = useState('will_follow')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    const res = await employeeAccessGetQuery<EmployeeAbsenceRow[]>(accessToken, 'sick-reports', {})
    if (res.ok && Array.isArray(res.data)) setList(res.data)
  }, [accessToken])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const sorted = useMemo(() => {
    return [...list].sort((a, b) => String(b.requestedAt ?? '').localeCompare(String(a.requestedAt ?? '')))
  }, [list])

  const submit = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await employeeAccessPostJson<Absence>(accessToken, 'sick-reports', {
        startDate,
        endDate,
        halfDay: false,
        comment: comment.trim() || undefined,
        certificateSource: certSource,
        kind: kind === 'child_sick' ? 'child_sick' : 'sick',
      })
      if (!res.ok || !res.data?.id) {
        const fail = res as { ok: false; error?: string }
        setErr(typeof fail.error === 'string' ? fail.error : 'Krankmeldung konnte nicht gesendet werden.')
        setBusy(false)
        return
      }
      const id = res.data.id
      if (file && (certSource === 'upload' || certSource === 'camera')) {
        const b64 = await readFileAsBase64(file)
        const up = await employeeAccessPostJson<{ id: string }>(accessToken, `sick-reports/${encodeURIComponent(id)}/attachments`, {
          fileBase64: b64,
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          source: certSource,
        })
        if (!up.ok) {
          const uf = up as { ok: false; error?: string }
          setErr(
            typeof uf.error === 'string'
              ? `${uf.error} (Meldung wurde gespeichert, Datei bitte erneut hochladen.)`
              : 'Datei-Upload fehlgeschlagen; Meldung wurde gespeichert.',
          )
        }
      }
      setFormOpen(false)
      setStartDate('')
      setEndDate('')
      setComment('')
      setFile(null)
      setCertSource('will_follow')
      setOkMsg('Krankmeldung wurde gesendet und wartet auf Prüfung.')
      await loadList()
      await onReload()
    } catch {
      setErr('Unerwarteter Fehler.')
    } finally {
      setBusy(false)
    }
  }

  const needFile = certSource === 'upload' || certSource === 'camera'

  return (
    <section className="mt-5 space-y-5">
      {okMsg ? (
        <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {okMsg}
          <button type="button" className="ml-3 underline" onClick={() => setOkMsg(null)}>
            OK
          </button>
        </div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>
      ) : null}

      <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-cyan-200">Krankmeldung</h2>
        <p className="mt-1 text-xs text-slate-500">
          Melde dich krank — die Leitung prüft und bestätigt. Genehmigen kannst du hier nicht selbst.
        </p>
        <Button
          type="button"
          variant="primary"
          className="mt-4 min-h-[52px] w-full py-3 text-base font-semibold sm:w-auto"
          onClick={() => {
            setErr(null)
            setFormOpen(true)
          }}
        >
          Krank melden
        </Button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-cyan-200">Meine Krankmeldungen</h2>
        {sorted.length === 0 ? (
          <p className="mt-2 text-slate-400">Noch keine Einträge.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sorted.map((a) => {
              const st = statusPresentation(a.status)
              return (
                <li key={a.id} className={`rounded-xl border px-4 py-3 text-sm ${st.className}`}>
                  <div className="flex items-start gap-2">
                    <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">
                        {formatDateDE(a.startDate)} – {formatDateDE(a.endDate)}
                      </p>
                      <p className="mt-1 text-xs text-slate-200/90">
                        {a.type === 'child_sick' ? 'Kind krank' : 'Krank'} · {st.label}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">Krankschreibung: {certLabel(a.certificateSource)}</p>
                      {a.requestedAt ? (
                        <p className="mt-2 text-[11px] text-slate-400">
                          Gemeldet: {a.requestedAt.length >= 16 ? formatDateTimeDE(a.requestedAt) : formatDateDE(a.requestedAt.slice(0, 10))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[118] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-cyan-500/30 bg-slate-950 p-5 shadow-2xl sm:rounded-2xl">
            <h2 className="text-lg font-semibold text-white">Krank melden</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Art</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value === 'child_sick' ? 'child_sick' : 'sick')}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white"
                >
                  <option value="sick">Krank</option>
                  <option value="child_sick">Kind krank</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Startdatum</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Enddatum</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Krankschreibung vorhanden?</span>
                <select
                  value={certSource}
                  onChange={(e) => {
                    setCertSource(e.target.value)
                    setFile(null)
                  }}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white"
                >
                  {CERT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {needFile ? (
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">
                    {certSource === 'camera' ? 'Foto (Kamera oder Galerie)' : 'Datei (JPG, PNG, PDF)'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    capture={certSource === 'camera' ? 'environment' : undefined}
                    className="mt-1 w-full text-sm text-slate-200"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Kommentar optional</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-base text-white placeholder:text-slate-600"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-[48px] flex-1" onClick={() => setFormOpen(false)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                className="min-h-[48px] flex-1"
                disabled={busy || !startDate || !endDate || endDate < startDate || (needFile && !file)}
                onClick={() => void submit()}
              >
                Senden
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
