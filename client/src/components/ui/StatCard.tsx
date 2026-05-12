import type { ReactNode } from 'react'
import { Card } from './Card'

type Props = {
  title: string
  value: ReactNode
  hint?: ReactNode
  icon: ReactNode
  accentClass: string
}

export function StatCard({ title, value, hint, icon, accentClass }: Props) {
  return (
    <Card
      padding="md"
      className={`relative overflow-hidden ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
            {value}
          </p>
          {hint ? (
            <div className="mt-1 text-xs text-[var(--text-faint)]">{hint}</div>
          ) : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-black/25 text-[var(--text-main)]">
          {icon}
        </div>
      </div>
    </Card>
  )
}
