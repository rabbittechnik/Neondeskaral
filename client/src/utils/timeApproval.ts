import type { AuthUser } from '../context/auth-context'

/** Zeitfreigaben-Navigation: irgendeine Station mit time.approve oder Global Admin. */
export function canApproveTimeEntries(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (user.globalAdmin) return true
  return Boolean(user.stationAccess?.some((a) => a.permissions['time.approve'] === true))
}
