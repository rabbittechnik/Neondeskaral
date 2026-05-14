import type { AuthUser } from '../context/auth-context'

function stationHas(user: AuthUser | null | undefined, key: string): boolean {
  if (!user) return false
  return Boolean(user.stationAccess?.some((a) => a.permissions[key] === true))
}

/** Zeitfreigaben-Navigation: Station mit Freigabe- oder Korrekturrecht (oder Global Admin). */
export function canAccessTimeApprovalsPage(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (user.globalAdmin) return true
  return stationHas(user, 'time.approve') || stationHas(user, 'time.correct')
}

/** Freigabe / Ablehnen / Korrektur anfordern (Nachprüfung). */
export function canApproveTimeEntries(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (user.globalAdmin) return true
  return stationHas(user, 'time.approve')
}

/** Manuelle Stempelzeit-Korrektur (revisionssicher). */
export function canCorrectStampTimes(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (user.globalAdmin) return true
  return stationHas(user, 'time.approve') || stationHas(user, 'time.correct')
}
