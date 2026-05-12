import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { useEmployees } from '../../context/employees-context'
import type { TimeEntry } from '../../types/timeTracking'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../utils/timeTrackingUtils'
import { apiGet } from '../../services/api'
import { useStation } from '../../context/station-context'

function sourceBadge(source: string | undefined): { label: string; className: string } {
  if (source === 'tablet' || source === 'cash_register_card_terminal') {
    return { label: 'Tablet', className: 'border-cyan-400/50 bg-cyan-950/80 text-cyan-100' }
  }
  if (source === 'employee_mobile_app') {
    return { label: 'Mitarbeiter-App', className: 'border-emerald-400/45 bg-emerald-950/70 text-emerald-100' }
  }
  if (source === 'manual') {
    return { label: 'Manuell', className: 'border-amber-400/45 bg-amber-950/70 text-amber-100' }
  }
  return { label: 'Zeit', className: 'border-white/15 bg-black/40 text-slate-200' }
}

function formatSince(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export function ActiveAttendanceBar() {
  const { stationId } = useStation()
  const { employees } = useEmployees()
  const [running, setRunning] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId) {
      setRunning([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const res = await apiGet<TimeEntry[]>('/time-entries/running', { stationId })
    if (!res.ok) {
      setRunning([])
      setError(res.error)
    } else {
      setRunning(Array.isArray(res.data) ? res.data : [])
    }
    setLoading(false)
  }, [stationId])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 45_000)
    return () => window.clearInterval(id)
  }, [load])

  const sorted = useMemo(() => {
    const list = [...running]
    list.sort((a, b) => a.startAt.localeCompare(b.startAt))
    return list
  }, [running])

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  return (
    <section
      className="rounded-[var(--radius-md)] border border-emerald-400/30 bg-gradient-to-r from-emerald-500/[0.12] via-cyan-500/[0.08] to-emerald-500/[0.12] px-4 py-3 shadow-[0_0_28px_rgba(52,211,153,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]"
      aria-label="Aktuell eingestempelt"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex shrink-0 items-center gap-2 text-emerald-100/95">
          <Users className="h-4 w-4 text-emerald-300" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight">Aktuell eingestempelt</h2>
        </div>

        {error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : loading ? (
          <p className="text-sm text-[var(--text-muted)]">Lade laufende Zeiten…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Aktuell ist niemand eingestempelt.</p>
        ) : (
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {sorted.map((e) => {
              const emp = byId.get(e.employeeId)
              const name = emp?.displayName ?? e.employeeId
              const mins = calculateWorkedMinutes(e.startAt, undefined, new Date())
              const dur = formatWorkedDuration(mins)
              const since = formatSince(e.startAt)
              const src = sourceBadge(e.source)
              return (
                <li key={e.id}>
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/35 bg-[var(--bg-elevated)]/90 px-3 py-1.5 text-xs shadow-[0_0_14px_rgba(16,185,129,0.2)]">
                    <span className="truncate font-semibold text-[var(--text-main)]">{name}</span>
                    <span className="shrink-0 text-[var(--text-muted)]">·</span>
                    <span className="shrink-0 tabular-nums text-emerald-200/90">seit {since}</span>
                    <span className="shrink-0 text-[var(--text-muted)]">·</span>
                    <span className="shrink-0 tabular-nums font-medium text-cyan-100/95">{dur}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${src.className}`}
                    >
                      {src.label}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
