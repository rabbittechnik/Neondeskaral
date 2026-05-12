import type { ReactNode } from 'react'
import { Card } from './Card'

type Props = {
  title: string
  value: ReactNode
  hint?: ReactNode
  icon: ReactNode
  accentClass: string
  /** `compact` = Mini-KPI (Dashboard links), `feature` = große Karte (z. B. Aufgaben) */
  density?: 'default' | 'compact' | 'feature'
  className?: string
}

export function StatCard({ title, value, hint, icon, accentClass, density = 'default', className = '' }: Props) {
  if (density === 'compact') {
    return (
      <Card
        padding="sm"
        className={`relative min-h-[88px] max-h-[100px] overflow-hidden ${accentClass} ${className}`}
      >
        <div className="flex h-full items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium leading-tight text-[var(--text-muted)]">{title}</p>
            <p className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight text-[var(--text-main)] md:text-xl">
              {value}
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-black/30 text-[var(--text-main)] shadow-inner shadow-black/20">
            {icon}
          </div>
        </div>
      </Card>
    )
  }

  if (density === 'feature') {
    return (
      <Card
        padding="md"
        className={`relative flex min-h-[280px] max-h-[320px] flex-col overflow-hidden md:min-h-[288px] md:max-h-none md:h-full ${accentClass} ${className}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-muted)]">{title}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--text-main)]">{value}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-black/25 text-[var(--text-main)]">
            {icon}
          </div>
        </div>
        {hint ? <div className="mt-3 flex min-h-0 flex-1 flex-col text-xs text-[var(--text-faint)]">{hint}</div> : null}
      </Card>
    )
  }

  return (
    <Card padding="md" className={`relative overflow-hidden ${accentClass} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-main)]">{value}</p>
          {hint ? <div className="mt-1 text-xs text-[var(--text-faint)]">{hint}</div> : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-black/25 text-[var(--text-main)]">
          {icon}
        </div>
      </div>
    </Card>
  )
}
