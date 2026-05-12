import { Check } from 'lucide-react'
import { WEEKDAY_IDS, WEEKDAY_SHORT, type WeekdayPrefId } from './planningPreferenceLabels'

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

const chipBase =
  'inline-flex min-w-[2.5rem] items-center justify-center gap-0.5 rounded-full border px-2 py-1.5 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50'

export function WorkDayPreferenceChips({ value, onChange, disabled }: Props) {
  const set = new Set(value)
  const toggle = (id: string) => {
    const n = new Set(set)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    onChange(Array.from(n))
  }

  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAY_IDS.map((id) => {
        const on = set.has(id)
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(id)}
            className={`${chipBase} ${
              on
                ? 'border-cyan-400/55 bg-cyan-500/15 text-cyan-50 shadow-[0_0_12px_rgba(34,211,238,0.22)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]/40 text-[var(--text-muted)] hover:border-cyan-400/25'
            }`}
          >
            {on ? <Check className="h-3 w-3" aria-hidden /> : null}
            {WEEKDAY_SHORT[id as WeekdayPrefId]}
          </button>
        )
      })}
    </div>
  )
}
