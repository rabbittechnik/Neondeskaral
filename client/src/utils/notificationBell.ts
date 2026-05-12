import type { AuthUser } from '../context/auth-context'

/** Glocke nur für Stationen, in denen Freigaben / TÜV / Urlaubsanträge relevant sind. */
export function canSeeNotificationBell(
  user: AuthUser | null | undefined,
  stationId: string | null | undefined,
): boolean {
  if (!user || !stationId) return false
  if (user.globalAdmin) return true
  const acc = user.stationAccess?.find((a) => a.stationId === stationId)
  if (!acc) return false
  const p = acc.permissions
  return Boolean(p['time.approve'] || p['tuvReports.view'] || p['absences.approve'])
}
