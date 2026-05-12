import { Construction } from 'lucide-react'
import { Card } from '../ui/Card'

type Props = {
  title: string
  description: string
}

export function ScheduleViewPlaceholder({ title, description }: Props) {
  return (
    <Card className="flex min-h-[280px] flex-col items-center justify-center border-dashed border-[var(--border-strong)] bg-[var(--bg-card)]/50 py-12 text-center">
      <Construction className="mb-4 h-12 w-12 text-[var(--text-muted)] opacity-70" aria-hidden />
      <h2 className="text-lg font-semibold text-[var(--text-main)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">{description}</p>
    </Card>
  )
}
