import { formatDE } from '../scheduleWeekUtils'
import type { AssistantSuggestedShift } from '../../../types/scheduleAssistant'
import { AssistantScoreBadge } from './AssistantScoreBadge'

type Props = {
  item: AssistantSuggestedShift
}

function kindLabel(shiftType: string): string {
  const m: Record<string, string> = {
    frueh: 'Früh',
    spaet: 'Spät',
    nacht: 'Nacht',
    mittel: 'Mittel',
    kurz: 'Kurz',
    schule: 'Schule',
  }
  return m[shiftType] ?? shiftType
}

export function AssistantSuggestionCard({ item }: Props) {
  const d = new Date(`${item.date}T12:00:00`)
  const name = item.employeeName ?? (item.employeeId ? 'Mitarbeiter' : 'Offen')
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/70 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-[var(--text-main)]">
          {formatDE(d)} · {kindLabel(item.shiftType)} · {item.startTime}–{item.endTime}
        </div>
        <AssistantScoreBadge level={item.level} score={item.score} />
      </div>
      <div className="mt-1 text-sm text-cyan-100/90">{name}</div>
      <div className="mt-1 text-[10px] text-[var(--text-muted)]">
        Bereich: <span className="text-[var(--text-main)]">{item.workAreaId}</span>
        {item.hints.length ? (
          <span className="mt-0.5 block text-emerald-200/80">
            {item.hints.slice(0, 4).join(' · ')}
          </span>
        ) : null}
      </div>
    </div>
  )
}
