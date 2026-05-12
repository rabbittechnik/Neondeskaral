import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { currentShifts, upcomingShifts } from './dashboardData'

export function CurrentShiftPanel() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">
        Wer hat jetzt Schicht?
      </h3>
      <ul className="mt-4 space-y-4">
        {currentShifts.map((s) => (
          <li key={s.name} className="flex gap-3">
            <Avatar name={s.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--text-main)]">{s.name}</span>
                <Badge tone="cyan">{s.role}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {s.start} – {s.end}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                  style={{ width: `${Math.round(s.progress * 100)}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function UpcomingShiftPanel() {
  return (
    <Card>
      <h3 className="text-base font-semibold text-[var(--text-main)]">
        Wer kommt danach?
      </h3>
      <ul className="mt-4 space-y-3">
        {upcomingShifts.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={s.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-main)]">
                  {s.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{s.detail}</p>
              </div>
            </div>
            <Badge tone="amber">{s.eta}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}
