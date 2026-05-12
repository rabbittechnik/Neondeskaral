import { Check } from 'lucide-react'
import { SHIFT_PREF_IDS, SHIFT_PREF_LABELS, type ShiftPrefId } from './planningPreferenceLabels'

const EXTRA: { id: string; label: string }[] = [
  { id: 'weekend', label: 'Wochenende' },
  { id: 'holiday', label: 'Feiertag' },
]

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

const chipBase =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50'

export function ShiftPreferenceChips({ value, onChange, disabled }: Props) {
  const set = new Set(value)
  const toggle = (id: string) => {
    const n = new Set(set)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    onChange(Array.from(n))
  }

  const render = (id: string, label: string) => {
    const on = set.has(id)
    return (
      <button
        key={id}
        type="button"
        disabled={disabled}
        onClick={() => toggle(id)}
        className={`${chipBase} ${
          on
            ? 'border-emerald-400/55 bg-emerald-500/15 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
            : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]/40 text-[var(--text-muted)] hover:border-cyan-400/30'
        }`}
      >
        {on ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : null}
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SHIFT_PREF_IDS.map((id) => render(id, SHIFT_PREF_LABELS[id as ShiftPrefId]))}
      {EXTRA.map((x) => render(x.id, x.label))}
    </div>
  )
}
