import { Link } from 'react-router-dom'
import type { TuvCurrentMonthCheck } from '../../types/tuvReport'
import { monthYearLabelDe } from './tuvReportUtils'

export function TuvReportReminderCard({ check }: { check: TuvCurrentMonthCheck | null }) {
  if (!check) return null

  const label = monthYearLabelDe(check.month, check.year)

  if (!check.required && (check.status === 'completed' || check.status === 'printed')) {
    return (
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/90">
        TÜV-Bericht {label} erledigt.
      </div>
    )
  }

  if (!check.required) return null

  if (check.status === 'missing') {
    return (
      <div className="rounded-lg border border-orange-400/45 bg-gradient-to-r from-orange-500/12 to-red-500/8 px-3 py-2 shadow-[0_0_16px_rgba(249,115,22,0.12)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-orange-100">Monatlicher TÜV-Bericht fehlt</p>
            <p className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">
              Für {label} wurde noch kein monatlicher TÜV-Bericht erstellt.
            </p>
          </div>
          <Link
            to="/tuv-berichte"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md bg-orange-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400 sm:self-center"
          >
            Bericht jetzt erstellen
          </Link>
        </div>
      </div>
    )
  }

  if (check.status === 'in_progress' && check.reportId) {
    return (
      <div className="rounded-lg border border-amber-400/45 bg-amber-500/10 px-3 py-2 shadow-[0_0_14px_rgba(234,179,8,0.1)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-100">TÜV-Bericht noch nicht abgeschlossen</p>
            <p className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">
              Der TÜV-Bericht für {label} ist noch nicht abgeschlossen.
            </p>
          </div>
          <Link
            to={`/tuv-berichte/${check.reportId}`}
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md border border-amber-400/50 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/15 sm:self-center"
          >
            Bericht fortsetzen
          </Link>
        </div>
      </div>
    )
  }

  return null
}
