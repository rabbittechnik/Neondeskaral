/** Demo: gleiche IDs wie im Server-Seed (Max Vins, Mathias Raselowski). */
const APPROVER_IDS = new Set(['user-max-vins', 'user-mathias-raselowski'])

export function canApproveTimeEntries(userId: string | undefined | null): boolean {
  if (!userId) return false
  return APPROVER_IDS.has(userId)
}
