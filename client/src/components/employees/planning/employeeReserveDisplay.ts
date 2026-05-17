import type { Employee } from '../../../types/employee'

/** Badge „Reserve aktiv“ – Light unverändert, Dark kontrastreich (Neon-Amber). */
export const employeeReserveBadgeClassName =
  'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
  'border-amber-500/45 bg-amber-500/15 text-amber-950 shadow-[0_0_10px_rgba(251,191,36,0.12)] ' +
  'dark:border-amber-400/75 dark:bg-[rgba(245,158,11,0.18)] dark:text-[#fbbf24] ' +
  'dark:shadow-[0_0_10px_rgba(245,158,11,0.22)]'

/** „Reserve: Ja“ in Schichtwünschen – Dark Mode heller Amber. */
export const employeeReserveYesTextClassName =
  'font-medium text-amber-900 dark:text-[#fbbf24] dark:drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]'

export function employeeReserveBadgeLabel(employee: Employee): string {
  const note = employee.reserveNote?.trim().toLowerCase() ?? ''
  if (note.includes('springer')) return 'Springer'
  if (note.includes('engpass') || note.includes('notfall')) return 'Bei Engpass verfügbar'
  return 'Reserve aktiv'
}

export function employeeReserveSummaryLines(employee: Employee): { reserve: string; hint?: string } {
  if (!employee.reserveEnabled) {
    return { reserve: 'Nein' }
  }
  return {
    reserve: 'Ja',
    hint: employee.reserveNote?.trim() || undefined,
  }
}
