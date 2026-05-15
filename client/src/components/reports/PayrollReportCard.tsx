import type { ReactNode } from 'react'
import { Card } from '../ui/Card'

type Props = {
  printId: string
  title: string
  metaLine: string
  userDisplayName?: string
  loading: boolean
  empty: boolean
  emptyMessage: string
  children: ReactNode
}

export function PayrollReportCard({
  printId,
  title,
  metaLine,
  userDisplayName,
  loading,
  empty,
  emptyMessage,
  children,
}: Props) {
  return (
    <Card padding="none" className="min-w-0 overflow-hidden border-cyan-500/15 print:border-white/20 print:shadow-none print:ring-0">
      <div id={printId} className="w-full p-6 print:p-2">
        <p className="mb-3 text-xs text-[var(--text-muted)] print:hidden">{metaLine}</p>
        <div className="mb-4 hidden print:block">
          <h2 className="text-lg font-semibold text-black">{title}</h2>
          <p className="text-sm text-black">{metaLine}</p>
          <p className="text-xs text-neutral-700">
            Erstellt: {new Date().toLocaleString('de-DE')}
            {userDisplayName ? ` · ${userDisplayName}` : ''}
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Lade Daten…</p>
        ) : empty ? (
          <p className="text-sm text-[var(--text-muted)]">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </Card>
  )
}
