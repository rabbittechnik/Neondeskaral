/** Nur diese Admin-Benutzer dürfen Zeiteinträge für die Abrechnung freigeben (Demo-IDs aus seed). */
export const TIME_ENTRY_APPROVER_USER_IDS = new Set(['user-max-vins', 'user-mathias-raselowski'])

export function canUserApproveTimeEntries(userId: string | undefined | null): boolean {
  if (!userId) return false
  return TIME_ENTRY_APPROVER_USER_IDS.has(userId)
}
