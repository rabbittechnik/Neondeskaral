import type { AbsenceStatus, AbsenceType } from '../../types/absence'

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  urlaub: 'Urlaub',
  krankheit: 'Krankheit',
  berufsschule: 'Berufsschule',
  frei: 'Frei',
  sonderurlaub: 'Sonderurlaub',
  unbezahlt: 'Unbezahlt',
  kind_krank: 'Kind krank',
  sonstiges: 'Sonstiges',
}

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  beantragt: 'Beantragt',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  storniert: 'Storniert',
}

export function absenceTypeBadgeClass(type: AbsenceType): string {
  const map: Record<AbsenceType, string> = {
    urlaub: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.25)]',
    krankheit: 'border-rose-400/55 bg-rose-500/15 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.25)]',
    berufsschule: 'border-sky-400/50 bg-sky-600/20 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.22)]',
    frei: 'border-violet-400/45 bg-violet-600/20 text-violet-100',
    sonderurlaub: 'border-amber-400/50 bg-amber-500/15 text-amber-100',
    unbezahlt: 'border-white/15 bg-white/5 text-[var(--text-muted)]',
    kind_krank: 'border-pink-400/50 bg-pink-500/15 text-pink-100',
    sonstiges: 'border-white/20 bg-white/5 text-[var(--text-muted)]',
  }
  return map[type]
}

export function absenceStatusBadgeTone(
  status: AbsenceStatus,
): 'success' | 'amber' | 'danger' | 'default' {
  if (status === 'genehmigt') return 'success'
  if (status === 'beantragt') return 'amber'
  if (status === 'abgelehnt') return 'danger'
  return 'default'
}
