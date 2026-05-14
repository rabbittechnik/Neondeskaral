/** Muss mit `server/src/constants/earlyLeaveCheckout.ts` übereinstimmen (Codes). */
export const EARLY_LEAVE_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'sick', label: 'Krankheit / gesundheitliche Gründe' },
  { value: 'replacement', label: 'Auswechslung durch anderen Mitarbeiter' },
  { value: 'agreed_change', label: 'Abgesprochener Wechsel' },
  { value: 'approved_by_manager', label: 'Chef / Stationsleitung hat es freigegeben' },
  { value: 'quiet_shift', label: 'Wenig los / früher Schluss nach Absprache' },
  { value: 'family_emergency', label: 'Familiärer Notfall' },
  { value: 'personal_emergency', label: 'Persönlicher Notfall' },
  { value: 'other', label: 'Sonstiges' },
]

export function earlyLeaveReasonLabelDeClient(code: string): string {
  const v = String(code ?? '').trim()
  return EARLY_LEAVE_REASON_OPTIONS.find((o) => o.value === v)?.label ?? v
}
