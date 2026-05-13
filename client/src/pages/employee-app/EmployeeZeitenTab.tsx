import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { employeeAccessGetQuery } from '../../services/api'
import {
  formatDateDE,
  formatMonthYearDE,
  formatShiftTimeRangeDE,
  formatTimeDE,
  formatWeekdayLongDE,
} from '../../utils/dateFormat'

export type EmployeeTimeEntryRead = {
  id: string
  date: string
  plannedStart?: string
  plannedEnd?: string
  clockInAt: string
  clockOutAt?: string
  pauseMinutes: number
  totalHours: number
  status: 'running' | 'pending_approval' | 'approved' | 'correction_required' | 'rejected'
}

type Payload = {
  month: string
  from: string
  to: string
  summary: { entryCount: number; totalHours: number; approvedHours: number; pendingHours: number }
  entries: EmployeeTimeEntryRead[]
}

function fmtHoursDe(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} Std.`
}

function statusPresentation(status: EmployeeTimeEntryRead['status']): { label: string; className: string } {
  switch (status) {
    case 'running':
      return { label: 'Laufend', className: 'border-cyan-400/45 bg-cyan-500/15 text-cyan-50' }
    case 'approved':
      return { label: 'Freigegeben', className: 'border-emerald-400/45 bg-emerald-500/15 text-emerald-50' }
    case 'pending_approval':
      return { label: 'Wartet auf Prüfung', className: 'border-amber-400/45 bg-amber-500/15 text-amber-50' }
    case 'correction_required':
      return { label: 'Korrektur angefordert', className: 'border-orange-500/50 bg-orange-500/15 text-orange-50' }
    case 'rejected':
      return { label: 'Abgelehnt / zurückgewiesen', className: 'border-rose-400/50 bg-rose-500/15 text-rose-50' }
    default:
      return { label: status, className: 'border-white/10 bg-white/5 text-slate-300' }
  }
}

type Props = { accessToken: string }

export function EmployeeZeitenTab({ accessToken }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<Payload | null>(null)

  const range = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const last = new Date(cursor.y, cursor.m, 0).getDate()
    const from = `${cursor.y}-${pad(cursor.m)}-01`
    const to = `${cursor.y}-${pad(cursor.m)}-${pad(last)}`
    const label = formatMonthYearDE(from)
    return { from, to, label }
  }, [cursor])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      const res = await employeeAccessGetQuery<Payload>(accessToken, 'time-entries', {
        from: range.from,
        to: range.to,
      })
      if (cancelled) return
      if (!res.ok || !res.data) {
        setErr(!res.ok && 'error' in res ? res.error : 'Zeiten konnten nicht geladen werden.')
        setData(null)
      } else {
        setData(res.data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, range.from, range.to])

  const goPrevMonth = () => {
    setCursor((c) => {
      if (c.m <= 1) return { y: c.y - 1, m: 12 }
      return { y: c.y, m: c.m - 1 }
    })
  }

  const goNextMonth = () => {
    setCursor((c) => {
      if (c.m >= 12) return { y: c.y + 1, m: 1 }
      return { y: c.y, m: c.m + 1 }
    })
  }

  const goThisMonth = () => {
    const d = new Date()
    setCursor({ y: d.getFullYear(), m: d.getMonth() + 1 })
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/55 p-4">
        <h2 className="text-sm font-semibold text-cyan-200">Zeiterfassung</h2>
        <p className="mt-1 text-xs text-slate-500">Nur zur Ansicht — Änderungen erfolgen über die Leitung.</p>

        <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-center gap-1 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] min-w-[44px] px-2"
              aria-label="Vorheriger Monat"
              onClick={goPrevMonth}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Button>
            <div className="min-w-[10rem] flex-1 text-center">
              <p className="text-base font-semibold text-white">{range.label}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] min-w-[44px] px-2"
              aria-label="Nächster Monat"
              onClick={goNextMonth}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          <div className="hidden gap-2 sm:flex sm:justify-end">
            <Button type="button" variant="outline" className="text-xs" onClick={goThisMonth}>
              Dieser Monat
            </Button>
          </div>
        </div>
        <Button type="button" variant="ghost" className="mt-2 w-full text-xs text-cyan-200/90 sm:hidden" onClick={goThisMonth}>
          Zum aktuellen Monat
        </Button>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Zeiten werden geladen…</p>
      ) : data && data.summary.entryCount === 0 ? (
        <p className="text-sm text-slate-400">Für diesen Monat wurden noch keine Arbeitszeiten erfasst.</p>
      ) : data ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zusammenfassung</p>
            <ul className="mt-3 space-y-2">
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Erfasste Schichten</span>
                <span className="font-medium text-white">{data.summary.entryCount}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Gesamtstunden</span>
                <span className="font-medium text-cyan-100">{fmtHoursDe(data.summary.totalHours)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Davon freigegeben</span>
                <span className="font-medium text-emerald-200/95">{fmtHoursDe(data.summary.approvedHours)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-400">Offen zur Prüfung</span>
                <span className="font-medium text-amber-100/95">{fmtHoursDe(data.summary.pendingHours)}</span>
              </li>
            </ul>
          </div>

          <ul className="space-y-3">
            {data.entries.map((e) => {
              const st = statusPresentation(e.status)
              const planned =
                e.plannedStart && e.plannedEnd ? formatShiftTimeRangeDE(e.plannedStart, e.plannedEnd) : null
              const clockInShort = formatTimeDE(e.clockInAt).replace(/\s*Uhr\s*$/i, '').trim()
              const clocked =
                e.clockOutAt != null
                  ? `${clockInShort} – ${formatTimeDE(e.clockOutAt)}`
                  : `${formatTimeDE(e.clockInAt)} (noch aktiv)`
              return (
                <li key={e.id} className={`rounded-xl border px-4 py-3 text-sm ${st.className}`}>
                  <p className="text-base font-semibold text-white">{formatWeekdayLongDE(e.date)}</p>
                  <p className="text-xs text-slate-300/90">{formatDateDE(e.date)}</p>
                  {planned ? (
                    <p className="mt-2 text-slate-200/95">
                      <span className="text-slate-400">Geplant:</span> {planned}
                    </p>
                  ) : null}
                  <p className="mt-1 text-slate-100">
                    <span className="text-slate-400">Gestempelt:</span> {clocked}
                  </p>
                  <p className="mt-1 text-slate-200/95">
                    <span className="text-slate-400">Pause:</span> {e.pauseMinutes} Min.
                  </p>
                  <p className="mt-1 text-slate-200/95">
                    <span className="text-slate-400">Berechnet:</span> {fmtHoursDe(e.totalHours)}
                  </p>
                  <p className="mt-2 text-xs font-medium">
                    <span className="text-slate-400">Status:</span> {st.label}
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}
