/** Nur Stations-Tablet-Zugang; keine Admin- oder Mitarbeiter-App-Tokens. */

export const STATION_TABLET_TOKEN_LS_KEY = 'rabbit_technik_station_tablet_token'

export function readStationTabletToken(): string | null {
  if (typeof window === 'undefined') return null
  const t = window.localStorage.getItem(STATION_TABLET_TOKEN_LS_KEY)?.trim()
  return t || null
}

export function writeStationTabletToken(token: string): void {
  if (typeof window === 'undefined') return
  const t = token.trim()
  if (!t) return
  try {
    window.localStorage.setItem(STATION_TABLET_TOKEN_LS_KEY, t)
  } catch {
    /* Quota / private mode */
  }
}

export function clearStationTabletToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STATION_TABLET_TOKEN_LS_KEY)
  } catch {
    /* ignore */
  }
}
