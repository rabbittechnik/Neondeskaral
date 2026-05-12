import type { DayRequirement } from '../../../types/scheduleAssistant'
import { formatDE } from '../scheduleWeekUtils'

type Props = {
  requirements: DayRequirement[]
  onChange: (next: DayRequirement[]) => void
}

function labelKind(kind: string): string {
  const m: Record<string, string> = {
    early: 'Früh',
    late: 'Spät',
    night: 'Nacht',
    middle: 'Mittel',
    short: 'Kurz',
    school: 'Schule',
  }
  return m[kind] ?? kind
}

export function AssistantRequirementStep({ requirements, onChange }: Props) {
  const toggle = (dayIdx: number, slotIdx: number) => {
    const next = requirements.map((d, i) => {
      if (i !== dayIdx) return d
      const slots = d.slots.map((s, j) => (j === slotIdx ? { ...s, required: !s.required } : s))
      return { ...d, slots }
    })
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        Standardzeiten Tankstelle (Mo–Fr / Sa / So). Schichten können pro Tag deaktiviert werden, wenn kein Bedarf
        besteht.
      </p>
      <div className="max-h-[min(48vh,480px)] space-y-2 overflow-y-auto pr-1">
        {requirements.map((day, di) => {
          const d = new Date(`${day.date}T12:00:00`)
          return (
            <div
              key={day.date}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 px-3 py-2"
            >
              <div className="mb-2 text-xs font-semibold text-cyan-100/90">{formatDE(d)}</div>
              <div className="flex flex-wrap gap-2">
                {day.slots.map((slot, si) => (
                  <button
                    key={`${slot.kind}-${si}`}
                    type="button"
                    onClick={() => toggle(di, si)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      slot.required
                        ? 'border-emerald-400/45 bg-emerald-500/12 text-emerald-50'
                        : 'border-white/10 bg-black/20 text-[var(--text-faint)] line-through'
                    }`}
                  >
                    {labelKind(slot.kind)} {slot.startTime}–{slot.endTime}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
