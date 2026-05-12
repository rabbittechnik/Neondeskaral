import { AlertTriangle } from 'lucide-react'

type Props = {
  warnings: string[]
}

export function AssistantWarningList({ warnings }: Props) {
  if (!warnings.length) return null
  return (
    <div className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-100">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Hinweise
      </div>
      <ul className="list-inside list-disc space-y-1 text-[11px] text-amber-50/95">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  )
}
