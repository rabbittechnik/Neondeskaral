import { useMemo } from 'react'
import { Users } from 'lucide-react'
import { useEmployees } from '../../context/employees-context'
import { useTimeTracking } from '../../context/time-tracking-context'
import type { TimeEntry } from '../../types/timeTracking'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../utils/timeTrackingUtils'

function sourceBadge(source: string | undefined): { label: string; className: string } {
  if (source === 'tablet' || source === 'cash_register_card_terminal') {
    return { label: 'Tablet', className: 'border-cyan-400/50 bg-cyan-950/80 text-cyan-100' }
  }
  if (source === 'employee_mobile_app') {
    return { label: 'App', className: 'border-emerald-400/45 bg-emerald-950/70 text-emerald-100' }
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
  const { timeEntries } = useTimeTracking()
  const { employees } = useEmployees()

  const running = useMemo(() => {
    const list = timeEntries.filter((e: TimeEntry) => e.status === 'running')
    list.sort((a, b) => a.startAt.localeCompare(b.startAt))
    return list
  }, [timeEntries])

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

        {running.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Aktuell ist niemand eingestempelt.</p>
        ) : (
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {running.map((e) => {
              const emp = byId.get(e.employeeId)
              const name = emp?.displayName ?? 'Mitarbeiter'
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
