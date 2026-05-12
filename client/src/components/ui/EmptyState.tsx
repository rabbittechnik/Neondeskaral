import type { ReactNode } from 'react'
import { Card } from './Card'

type Props = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
      {icon ? (
        <div className="mb-4 text-[var(--text-muted)] opacity-80">{icon}</div>
      ) : null}
      <h2 className="text-lg font-medium text-[var(--text-main)]">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  )
}
