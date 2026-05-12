import type { TuvReportStatus } from '../../types/tuvReport'

const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export function monthYearLabelDe(month: number, year: number): string {
  const m = MONTHS_DE[month - 1] ?? String(month)
  return `${m} ${year}`
}

export function statusLabelDe(s: TuvReportStatus | string): string {
  switch (s) {
    case 'draft':
      return 'Offen'
    case 'in_progress':
      return 'In Bearbeitung'
    case 'completed':
      return 'Abgeschlossen'
    case 'printed':
      return 'Gedruckt'
    default:
      return s
  }
}

export function statusBadgeClass(s: TuvReportStatus | string): string {
  switch (s) {
    case 'draft':
      return 'border-slate-400/40 bg-slate-500/15 text-slate-200'
    case 'in_progress':
      return 'border-amber-400/50 bg-amber-500/15 text-amber-100'
    case 'completed':
      return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
    case 'printed':
      return 'border-cyan-400/45 bg-cyan-500/12 text-cyan-100'
    default:
      return 'border-[var(--border-subtle)] text-[var(--text-muted)]'
  }
}
