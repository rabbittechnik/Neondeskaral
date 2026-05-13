import { API_BASE } from '../services/api'
import { parseAccessPasteInput } from './accessPasteInput'

/** QR-Inhalt parsen; lehnt Mitarbeiter-Links ab (Klartext, kein Raten nach PWA). */
export function extractTabletTokenFromQrText(raw: string): { token: string | null; error?: string } {
  const p = parseAccessPasteInput(raw)
  if (p.kind === 'employee') {
    return { token: null, error: 'Das ist kein Stations-Tablet-QR-Code.' }
  }
  if (p.kind === 'tablet') return { token: p.token }
  if (p.kind === 'ambiguous') return { token: p.token }
  return { token: null, error: p.message }
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
      : 'Dieser Zugang ist ungültig oder wurde deaktiviert.'
  return { ok: false, error: err, status: res.status }
}
