import { API_BASE } from '../services/api'

/** QR-Inhalt parsen; lehnt offensichtlich falsche App-Routen ab. */
export function extractTabletTokenFromQrText(raw: string): { token: string | null; error?: string } {
  const t = raw.trim()
  if (!t) return { token: null, error: 'Leerer Inhalt.' }

  const lower = t.toLowerCase()
  if (
    lower.includes('/employee-access/') ||
    lower.includes('/employee-app') ||
    lower.includes('/login') ||
    lower.includes('/auth/')
  ) {
    return { token: null, error: 'Das ist kein Stations-Tablet-QR-Code.' }
  }

  const pathMatch = t.match(/\/tablet\/([^/?#\s]+)/)
  if (pathMatch) {
    return { token: decodeURIComponent(pathMatch[1]) }
  }

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      const m = u.pathname.match(/\/tablet\/([^/?#]+)/)
      if (m) return { token: decodeURIComponent(m[1]) }
      return { token: null, error: 'Kein Tablet-Link erkannt (Pfad muss /tablet/… enthalten).' }
    } catch {
      return { token: null, error: 'Ungültiger Link.' }
    }
  }

  if (t.startsWith('/tablet/')) {
    const seg = t.slice('/tablet/'.length).split(/[/?#]/)[0]
    return seg ? { token: decodeURIComponent(seg) } : { token: null, error: 'Kein Token im Pfad.' }
  }

  if (t.includes('/') || t.includes('://')) {
    return { token: null, error: 'Kein gültiger Tablet-Link erkannt.' }
  }

  if (/^[a-zA-Z0-9_.-]+$/.test(t) && t.length >= 6) {
    return { token: t }
  }

  return { token: null, error: 'Token konnte nicht erkannt werden.' }
}

export async function validateTabletSession(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const res = await fetch(`${API_BASE}/tablet/session/${encodeURIComponent(token)}`)
  let json: { ok?: boolean; data?: { station?: { id?: string } }; error?: string } = {}
  try {
    json = (await res.json()) as typeof json
  } catch {
    /* ignore */
  }
  if (res.ok && json.ok !== false && json.data?.station?.id) {
    return { ok: true }
  }
  const err =
    typeof json.error === 'string' && json.error.trim()
      ? json.error.trim()
      : 'Dieser QR-Code ist kein gültiger Stations-Tablet-Zugang.'
  return { ok: false, error: err, status: res.status }
}
