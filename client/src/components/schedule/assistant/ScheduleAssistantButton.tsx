import { Sparkles } from 'lucide-react'

type Props = {
  onClick: () => void
}

export function ScheduleAssistantButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-emerald-400/50 bg-gradient-to-r from-emerald-500/25 via-cyan-500/20 to-cyan-400/15 px-3 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_20px_rgba(52,211,153,0.25)] transition hover:border-emerald-300/70 hover:shadow-[0_0_28px_rgba(34,211,238,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
      Schichtplan-Assistent
    </button>
  )
}
