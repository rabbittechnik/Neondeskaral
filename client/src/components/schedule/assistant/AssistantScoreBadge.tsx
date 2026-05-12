import type { AssistantSuggestedShift } from '../../../types/scheduleAssistant'

type Props = {
  level: AssistantSuggestedShift['level']
  score: number
}

export function AssistantScoreBadge({ level, score }: Props) {
  const cls =
    level === 'good'
      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
      : level === 'warn'
        ? 'border-amber-400/45 bg-amber-500/12 text-amber-100'
        : 'border-rose-400/50 bg-rose-500/15 text-rose-100'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${cls}`}
    >
      {score > -500 ? `Score ${Math.round(score)}` : 'Konflikt'}
    </span>
  )
}
