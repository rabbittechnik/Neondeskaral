import type { WeekdayAvailabilityMap, WeekdayAvailabilityLevel } from '../../../types/employeePlanning'
import {
  WEEKDAY_AVAILABILITY_KEYS,
  WEEKDAY_AVAILABILITY_LABELS,
  defaultWeekdayAvailability,
} from '../../../types/employeePlanning'
import { WEEKDAY_SHORT, type WeekdayPrefId } from './planningPreferenceLabels'
import { labelClass } from '../../schedule/shift/fieldStyles'

type Props = {
  value: WeekdayAvailabilityMap | undefined
  onChange: (next: WeekdayAvailabilityMap) => void
  disabled?: boolean
}

const LEVELS: WeekdayAvailabilityLevel[] = ['available', 'preferred', 'only_if_needed', 'unavailable']

const levelColor: Record<WeekdayAvailabilityLevel, string> = {
  available: 'border-[var(--border-strong)] bg-[var(--bg-card)]/50 text-[var(--text-muted)]',
  preferred: 'border-emerald-400/55 bg-emerald-500/15 text-emerald-100',
  only_if_needed: 'border-amber-400/50 bg-amber-500/12 text-amber-100',
  unavailable: 'border-rose-400/45 bg-rose-500/12 text-rose-100',
}

export function WeekdayAvailabilityMatrix({ value, onChange, disabled }: Props) {
  const map = value ?? defaultWeekdayAvailability()

  const cycle = (day: WeekdayPrefId) => {
    const cur = map[day]
    const i = LEVELS.indexOf(cur)
    const next = LEVELS[(i + 1) % LEVELS.length]!
    onChange({ ...map, [day]: next })
  }

  return (
    <div>
      <span className={labelClass}>Tagesverfügbarkeit (Mo–So)</span>
      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
        Tippen zum Wechseln: verfügbar → bevorzugt → nur wenn nötig → nicht verfügbar
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAY_AVAILABILITY_KEYS.map((day) => {
          const level = map[day]
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => cycle(day as WeekdayPrefId)}
              className={`rounded-[var(--radius-sm)] border px-2 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50 ${levelColor[level]}`}
            >
              <div className="text-[11px] font-semibold">{WEEKDAY_SHORT[day as WeekdayPrefId]}</div>
              <div className="mt-0.5 text-[9px] leading-tight opacity-90">
                {WEEKDAY_AVAILABILITY_LABELS[level]}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
