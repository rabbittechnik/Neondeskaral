/** DB-/API-Status: welche Abwesenheiten in Lohn & Zusammenfassung zählen. */
export function isAbsenceStatusApprovedForPayrollDb(status: unknown): boolean {
  const st = String(status ?? '')
    .toLowerCase()
    .trim()
  return st === 'approved' || st === 'genehmigt'
}
