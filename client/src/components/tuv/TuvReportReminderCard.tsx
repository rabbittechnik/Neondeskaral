import { Link } from 'react-router-dom'
import type { TuvCurrentMonthCheck } from '../../types/tuvReport'
import { monthYearLabelDe } from './tuvReportUtils'

export function TuvReportReminderCard({ check }: { check: TuvCurrentMonthCheck | null }) {
  if (!check) return null

  const label = monthYearLabelDe(check.month, check.year)

  if (!check.required && (check.status === 'completed' || check.status === 'printed')) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100/90">
        TÜV-Bericht {label} erledigt.
      </div>
    )
  }

  if (!check.required) return null

  if (check.status === 'missing') {
    return (
      <div className="rounded-xl border border-orange-400/45 bg-gradient-to-br from-orange-500/15 to-red-500/10 p-4 shadow-[0_0_28px_rgba(249,115,22,0.15)]">
        <div className="text-sm font-semibold text-orange-100">Monatlicher TÜV-Bericht fehlt</div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Für {label} wurde noch kein monatlicher TÜV-Bericht erstellt.
        </p>
        <Link
          to="/tuv-berichte"
          className="mt-3 inline-flex rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400"
        >
          Bericht jetzt erstellen
        </Link>
      </div>
    )
  }

  if (check.status === 'in_progress' && check.reportId) {
    return (
      <div className="rounded-xl border border-amber-400/45 bg-amber-500/10 p-4 shadow-[0_0_24px_rgba(234,179,8,0.12)]">
        <div className="text-sm font-semibold text-amber-100">TÜV-Bericht noch nicht abgeschlossen</div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Der TÜV-Bericht für {label} ist noch nicht abgeschlossen.
        </p>
        <Link
          to={`/tuv-berichte/${check.reportId}`}
          className="mt-3 inline-flex rounded-lg border border-amber-400/50 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/15"
        >
          Bericht fortsetzen
        </Link>
      </div>
    )
  }

  return null
}
