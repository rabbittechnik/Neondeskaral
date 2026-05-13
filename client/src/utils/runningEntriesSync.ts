/** Damit das Dashboard „Aktuell eingestempelt“ nach Terminal-Check-in/out sofort nachlädt. */
export const RUNNING_ENTRIES_REFRESH_EVENT = 'neonshift:running-entries-refresh'

export function notifyRunningEntriesRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(RUNNING_ENTRIES_REFRESH_EVENT))
}
