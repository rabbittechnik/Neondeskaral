import type { AssistantSuggestedShift } from '../../../types/scheduleAssistant'
import { AssistantSuggestionCard } from './AssistantSuggestionCard'
import { AssistantWarningList } from './AssistantWarningList'

type Props = {
  suggestedShifts: AssistantSuggestedShift[]
  warnings: string[]
}

export function AssistantSuggestionPreview({ suggestedShifts, warnings }: Props) {
  const byDate = new Map<string, AssistantSuggestedShift[]>()
  for (const s of suggestedShifts) {
    const list = byDate.get(s.date) ?? []
    list.push(s)
    byDate.set(s.date, list)
  }
  const dates = [...byDate.keys()].sort()

  return (
    <div className="space-y-4">
      <AssistantWarningList warnings={warnings} />
      <div className="max-h-[min(52vh,560px)] space-y-4 overflow-y-auto pr-1">
        {dates.map((date) => (
          <div key={date}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">
              {date}
            </p>
            <div className="space-y-2">
              {(byDate.get(date) ?? []).map((item) => (
                <AssistantSuggestionCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
