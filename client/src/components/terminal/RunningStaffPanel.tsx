import type { Employee } from '../../types/employee'
import type { TimeEntry } from '../../types/timeTracking'
import { calculateWorkedMinutes, formatWorkedDuration, getTodayTimeEntries } from '../../utils/timeTrackingUtils'
import { toISODateLocal } from '../../utils/taskUtils'

type Props = {
  entries: TimeEntry[]
  employees: Employee[]
}

export function RunningStaffPanel({ entries, employees }: Props) {
  const today = toISODateLocal(new Date())
  const now = new Date()
  const running = getTodayTimeEntries(entries, today).filter((e) => e.status === 'running')

  return (
    <section className="mt-10 w-full max-w-3xl rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6">
      <h3 className="text-center text-xl font-semibold text-[var(--text-main)] sm:text-2xl">Aktuell anwesend</h3>
      {running.length === 0 ? (
        <p className="mt-4 text-center text-base text-[var(--text-faint)]">Niemand eingestempelt.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {running.map((e) => {
            const emp = employees.find((x) => x.id === e.employeeId)
            const name = emp?.displayName ?? 'Mitarbeiter'
            const seit = new Date(e.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            const mins = calculateWorkedMinutes(e.startAt, undefined, now)
            const dur = formatWorkedDuration(mins)
            return (
              <li
                key={e.id}
                className="flex flex-col gap-1 rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-base sm:flex-row sm:items-center sm:justify-between sm:text-lg"
              >
                <span className="font-semibold text-emerald-100">{name}</span>
                <span className="text-[var(--text-muted)]">
                  seit {seit} · <span className="text-cyan-200/90">{dur}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
