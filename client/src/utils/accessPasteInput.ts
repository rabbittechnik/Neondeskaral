/**
 * Erkennt Mitarbeiter- vs. Stations-Tablet-Links aus QR oder manueller Eingabe.
 * Keine Heuristik nach PWA/Gerät — nur URL-Pfad und optional reines Token.
 */

export type ParsedAccessInput =
  | { kind: 'employee'; token: string }
  | { kind: 'tablet'; token: string }
  | { kind: 'ambiguous'; token: string }
  | { kind: 'invalid'; message: string }

export const MSG_LINK_UNRECOGNIZED =
  'Der eingegebene Link konnte nicht erkannt werden. Bitte vollständigen QR-Link kopieren oder QR-Code erneut scannen.'

function classifyPathname(pathname: string): ParsedAccessInput | null {
  const norm = pathname.replace(/\/+$/, '') || '/'
  const em = norm.match(/\/employee\/([^/]+)$/i) ?? norm.match(/\/employee-access\/([^/]+)$/i)
  if (em?.[1]) {
    const tok = decodeURIComponent(em[1]).trim()
    return tok ? { kind: 'employee', token: tok } : null
  }
  const tabm = norm.match(/\/tablet\/([^/]+)$/i)
  if (tabm?.[1]) {
    const seg = decodeURIComponent(tabm[1]).trim()
    if (!seg) return null
    if (seg.toLowerCase() === 'dev') return null
    return { kind: 'tablet', token: seg }
  }
  return null
}

/** Eingabe aus QR, Adresszeile oder Textfeld parsen (URLs mit Query/Hash, trailing slash). */
export function parseAccessPasteInput(raw: string): ParsedAccessInput {
  const t = raw.trim().replace(/^\uFEFF/, '')
  if (!t) return { kind: 'invalid', message: MSG_LINK_UNRECOGNIZED }

  const lower = t.toLowerCase()
  if (
    lower.includes('/login') ||
    (lower.includes('/dashboard') && !lower.includes('/tablet/')) ||
    lower.includes('/settings/') ||
    lower.includes('/account/')
  ) {
    return {
      kind: 'invalid',
      message: 'Das sieht nach einem Admin-Link aus, nicht nach einem Mitarbeiter- oder Tablet-Zugang.',
    }
  }

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      const hit = classifyPathname(u.pathname)
      if (hit) return hit
      return { kind: 'invalid', message: MSG_LINK_UNRECOGNIZED }
    } catch {
      return { kind: 'invalid', message: MSG_LINK_UNRECOGNIZED }
    }
  }

  if (t.startsWith('/')) {
    try {
      const u = new URL(t, 'https://placeholder.local')
      const hit = classifyPathname(u.pathname)
      if (hit) return hit
    } catch {
      /* ignore */
    }
  }

  if (t.includes('/') || t.includes('://')) {
    return { kind: 'invalid', message: MSG_LINK_UNRECOGNIZED }
  }

  if (/^[a-zA-Z0-9_.-]+$/.test(t) && t.length >= 6) {
    return { kind: 'ambiguous', token: t }
  }

  return { kind: 'invalid', message: MSG_LINK_UNRECOGNIZED }
}
