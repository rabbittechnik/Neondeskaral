/** Mehr als so viele Minuten vor Plan-Ende → Stations-Tablet: Pflichtgrund (Europe/Berlin-Logik im Aufrufer). */
export const EARLY_LEAVE_REASON_REQUIRED_MINUTES = 30

export const EARLY_LEAVE_REASON_CODES = [
  'sick',
  'replacement',
  'agreed_change',
  'approved_by_manager',
  'quiet_shift',
  'family_emergency',
  'personal_emergency',
  'other',
] as const

export type EarlyLeaveReasonCode = (typeof EARLY_LEAVE_REASON_CODES)[number]

const REASON_LABELS: Record<EarlyLeaveReasonCode, string> = {
  sick: 'Krankheit / gesundheitliche Gründe',
  replacement: 'Auswechslung durch anderen Mitarbeiter',
  agreed_change: 'Abgesprochener Wechsel',
  approved_by_manager: 'Chef / Stationsleitung hat es freigegeben',
  quiet_shift: 'Wenig los / früher Schluss nach Absprache',
  family_emergency: 'Familiärer Notfall',
  personal_emergency: 'Persönlicher Notfall',
  other: 'Sonstiges',
}

export function earlyLeaveReasonLabelDe(code: string): string {
  const c = String(code ?? '').trim() as EarlyLeaveReasonCode
  return REASON_LABELS[c] ?? code
}

export type ParsedEarlyLeaveAck = {
  reason: EarlyLeaveReasonCode
  note: string | null
}

export function parseEarlyLeaveAck(raw: unknown): { ok: true; data: ParsedEarlyLeaveAck } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Grund erforderlich.' }
  }
  const o = raw as Record<string, unknown>
  const reason = String(o.reason ?? '').trim()
  if (!EARLY_LEAVE_REASON_CODES.includes(reason as EarlyLeaveReasonCode)) {
    return { ok: false, error: 'Ungültiger Grund.' }
  }
  const note = String(o.note ?? '').trim()
  if (reason === 'other' && !note) {
    return { ok: false, error: 'Bei „Sonstiges“ ist eine Bemerkung erforderlich.' }
  }
  return { ok: true, data: { reason: reason as EarlyLeaveReasonCode, note: note || null } }
}
