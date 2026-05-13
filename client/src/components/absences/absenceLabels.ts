import type { AbsenceStatus, AbsenceType } from '../../types/absence'

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  paid_vacation: 'Bezahlter Urlaub',
  unpaid_vacation: 'Unbezahlter Urlaub',
  day_off: 'Frei',
  sick: 'Krank',
  special_leave: 'Sonderurlaub',
  child_sick: 'Kind krank',
  other: 'Sonstiges',
  school: 'Berufsschule',
}

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  beantragt: 'Wartet auf Prüfung',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  storniert: 'Storniert',
  erfasst: 'Erfasst',
}

export function absenceTypeBadgeClass(type: AbsenceType): string {
  const map: Record<AbsenceType, string> = {
    paid_vacation: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.25)]',
    unpaid_vacation: 'border-white/20 bg-white/8 text-slate-200',
    sick: 'border-rose-400/55 bg-rose-500/15 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.25)]',
    school: 'border-sky-400/50 bg-sky-600/20 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.22)]',
    day_off: 'border-violet-400/45 bg-violet-600/20 text-violet-100',
    special_leave: 'border-amber-400/50 bg-amber-500/15 text-amber-100',
    child_sick: 'border-pink-400/50 bg-pink-500/15 text-pink-100',
    other: 'border-white/20 bg-white/5 text-[var(--text-muted)]',
  }
  return map[type]
}

export function absenceStatusBadgeTone(
  status: AbsenceStatus,
): 'success' | 'amber' | 'danger' | 'default' {
  if (status === 'genehmigt' || status === 'erfasst') return 'success'
  if (status === 'beantragt') return 'amber'
  if (status === 'abgelehnt') return 'danger'
  return 'default'
}
