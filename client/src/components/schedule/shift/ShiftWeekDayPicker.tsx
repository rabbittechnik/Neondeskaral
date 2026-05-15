import { toISODate } from '../../../data/mockSchedule'
import {
  formatDayMonthDot,
  weekDayDates,
  WEEKDAY_LABELS_SHORT,
} from '../scheduleWeekUtils'

type Props = {
  weekMonday: Date
  selected: string[]
  onChange: (dates: string[]) => void
  disabled?: boolean
}

export function ShiftWeekDayPicker({ weekMonday, selected, onChange, disabled }: Props) {
  const days = weekDayDates(weekMonday)
  const set = new Set(selected)

  const toggle = (iso: string) => {
    if (disabled) return
    const next = new Set(set)
    if (next.has(iso)) next.delete(iso)
    else next.add(iso)
    const sorted = [...next].sort()
    onChange(sorted.length > 0 ? sorted : [iso])
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Tage in dieser Woche</p>
      <div className="flex flex-wrap gap-2">
          {days.map((d, i) => {
            const iso = toISODate(d)
            const active = set.has(iso)
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                onClick={() => toggle(iso)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-50'
                    : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]/50 text-[var(--text-muted)] hover:border-cyan-400/35'
                }`}
              >
                {WEEKDAY_LABELS_SHORT[i]} · {formatDayMonthDot(d)}
              </button>
            )
          })}
      </div>
    </div>
  )
}
