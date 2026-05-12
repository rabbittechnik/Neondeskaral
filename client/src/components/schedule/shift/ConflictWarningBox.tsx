import { AlertTriangle } from 'lucide-react'

type Props = {
  warnings: string[]
}

export function ConflictWarningBox({ warnings }: Props) {
  if (warnings.length === 0) return null

  return (
    <div className="rounded-[var(--radius-sm)] border border-orange-400/40 bg-gradient-to-br from-orange-500/10 to-red-500/5 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-200/90">
            Hinweise / mögliche Konflikte
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text-muted)]">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
