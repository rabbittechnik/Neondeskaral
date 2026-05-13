import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { useEmployees } from '../../context/employees-context'
import type { TimeEntry } from '../../types/timeTracking'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../utils/timeTrackingUtils'
import { apiGet } from '../../services/api'
import { useStation } from '../../context/station-context'
import {
  RUNNING_ENTRIES_REFRESH_EVENT,
} from '../../utils/runningEntriesSync'

function sourceBadge(source: string | undefined): { label: string; className: string } {
  if (source === 'tablet' || source === 'cash_register_card_terminal') {
    return { label: 'TABLET', className: 'border-cyan-400/50 bg-cyan-950/80 text-cyan-100' }
  }
  if (source === 'employee_mobile_app') {
    return { label: 'MITARBEITER-APP', className: 'border-emerald-400/45 bg-emerald-950/70 text-emerald-100' }
  }
  if (source === 'manual') {
    return { label: 'MANUELL', className: 'border-amber-400/45 bg-amber-950/70 text-amber-100' }
  }
  return { label: 'ZEIT', className: 'border-white/15 bg-black/40 text-slate-200' }
}

function formatSinceClock(iso: string): string {
  try {
    const t = new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    return `${t} Uhr`
  } catch {
    return '—'
  }
}

function displayNameForEntry(e: TimeEntry, employeeDisplayName: string | undefined): string {
  const fromApi = e.employeeName?.trim()
  const fromCtx = employeeDisplayName?.trim()
  return fromApi || fromCtx || 'Mitarbeiter'
}

type ActiveAttendanceBarProps = {
  className?: string
}

export function ActiveAttendanceBar({ className }: ActiveAttendanceBarProps) {
  const { stationId } = useStation()
  const { employees } = useEmployees()
  const [running, setRunning] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Jede Minute neu rendern für Laufzeit-Anzeige */
  const [nowTick, setNowTick] = useState(() => Date.now())

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
    setNowTick(Date.now())
  }, [stationId])

  useEffect(() => {
    void load()
    const poll = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(poll)
  }, [load])

  useEffect(() => {
    const onRefresh = () => void load()
    window.addEventListener(RUNNING_ENTRIES_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(RUNNING_ENTRIES_REFRESH_EVENT, onRefresh)
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const sorted = useMemo(() => {
    const list = [...running]
    list.sort((a, b) => a.startAt.localeCompare(b.startAt))
    return list
  }, [running])

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const now = useMemo(() => new Date(nowTick), [nowTick])

  return (
    <section
      className={`w-full min-w-0 rounded-[var(--radius-md)] border border-emerald-400/30 bg-gradient-to-r from-emerald-500/[0.12] via-cyan-500/[0.08] to-emerald-500/[0.12] px-3 py-2 shadow-[0_0_20px_rgba(52,211,153,0.1),inset_0_1px_0_rgba(255,255,255,0.06)] ${className ?? ''}`}
      aria-label="Aktuell eingestempelt"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        {error ? (
          <p className="flex min-w-0 items-center gap-2 text-sm text-rose-300" title={error}>
            <Users className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
            <span>Aktuell eingestempelt konnte nicht geladen werden.</span>
          </p>
        ) : loading ? (
          <p className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-muted)]">
            <Users className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
            <span className="font-semibold text-emerald-100/95">Aktuell eingestempelt</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span>Lade laufende Zeiten…</span>
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            <Users className="mr-1.5 inline h-3.5 w-3.5 text-emerald-300 align-text-bottom" aria-hidden />
            <span className="font-semibold text-emerald-100/95">Aktuell eingestempelt</span>
            <span className="text-[var(--text-faint)]"> · </span>
            Niemand eingestempelt.
          </p>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1.5 text-emerald-100/95">
              <Users className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
              <span className="text-sm font-semibold tracking-tight">Aktuell eingestempelt</span>
            </div>
            <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {sorted.map((e) => {
              const emp = byId.get(e.employeeId)
              const name = displayNameForEntry(e, emp?.displayName)
              const mins = calculateWorkedMinutes(e.startAt, undefined, now)
              const dur = formatWorkedDuration(mins)
              const since = formatSinceClock(e.startAt)
              const src = sourceBadge(e.source)
              return (
                <li key={e.id}>
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-400/35 bg-[var(--bg-elevated)]/90 px-2.5 py-1 text-xs shadow-[0_0_12px_rgba(16,185,129,0.18)]">
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
          </>
        )}
      </div>
    </section>
  )
}