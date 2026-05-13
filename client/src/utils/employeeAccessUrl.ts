/** Persönlicher Mitarbeiter-App-Link (relativ zur aktuellen Origin). */
export function buildEmployeeAccessUrl(token: string): string {
  if (typeof window === 'undefined') return `/employee/${encodeURIComponent(token)}`
  return `${window.location.origin}/employee/${encodeURIComponent(token)}`
}
