import type { TabletRunningRow } from '../../context/tablet-terminal-context'
import { formatTimeDE } from '../../utils/dateFormat'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../utils/timeTrackingUtils'

function sourceLabelDe(source: string): string {
  const s = source.toLowerCase()
  if (s === 'tablet') return 'Tablet'
  if (s === 'employee_mobile_app' || s.includes('employee')) return 'Mitarbeiter-App'
  if (s === 'manual') return 'Manuell'
  return source || '—'
}

type Props = {
  rows: TabletRunningRow[]
}

export function RunningStaffPanel({ rows }: Props) {
  const now = new Date()

  return (
    <section className="mt-10 w-full max-w-3xl rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6">
      <h3 className="text-center text-xl font-semibold text-[var(--text-main)] sm:text-2xl">Aktuell anwesend</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-center text-base text-[var(--text-faint)]">Niemand eingestempelt.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((e) => {
            const seit = formatTimeDE(e.startAt).replace(/\s*Uhr\s*$/i, '').trim()
            const mins = calculateWorkedMinutes(e.startAt, undefined, now)
            const dur = formatWorkedDuration(mins)
            return (
              <li
                key={e.id}
                className="flex flex-col gap-1 rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-base sm:flex-row sm:items-center sm:justify-between sm:text-lg"
              >
                <span className="font-semibold text-emerald-100">{e.displayName}</span>
                <span className="text-[var(--text-muted)]">
                  seit {seit} · <span className="text-cyan-200/90">{dur}</span>
                  <span className="mt-1 block text-sm text-[var(--text-faint)] sm:mt-0 sm:ml-3 sm:inline">
                    Quelle: {sourceLabelDe(e.source)}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
