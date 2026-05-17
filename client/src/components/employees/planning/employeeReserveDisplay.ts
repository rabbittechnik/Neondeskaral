import type { Employee } from '../../../types/employee'

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
