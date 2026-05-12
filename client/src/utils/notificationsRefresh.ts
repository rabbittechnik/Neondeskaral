export const NOTIFICATIONS_REFRESH_EVENT = 'neonshift-notifications-refresh'

export function dispatchNotificationsRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT))
}
