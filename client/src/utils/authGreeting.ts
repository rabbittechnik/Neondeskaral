import type { AuthUser } from '../context/auth-context'

/**
 * Anzeigename für Dashboard-Begrüßung: nicht hardcodieren, immer aus Session-User.
 * Reihenfolge: firstName → displayName → name → username → null (dann nur „Willkommen zurück“).
 */
export function dashboardGreetingName(user: AuthUser | null | undefined): string | null {
  if (!user) return null
  const pick = (v: string | undefined | null) => {
    const s = String(v ?? '').trim()
    return s.length > 0 ? s : null
  }
  return pick(user.firstName) ?? pick(user.displayName) ?? pick(user.name) ?? pick(user.username)
}
