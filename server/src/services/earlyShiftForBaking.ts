import type { ShiftRow } from './shiftService.js'

function parseHHMMToMinutes(t: string): number {
  const [h, m] = String(t ?? '').split(':').map(Number)
  return (h ?? 99) * 60 + (m ?? 0)
}

/** Frühschicht / Backshop-relevant: Backwaren-Popup nach Check-in (nicht blockierend). */
export function isEarlyShiftForBakingNotice(shift: ShiftRow | null): boolean {
  if (!shift) return false
  const type = String(shift.shift_type ?? '').trim().toLowerCase()
  if (type.includes('frei')) return false
  if (
    type.includes('spaet') ||
    type.includes('spät') ||
    type.includes('late') ||
    type.includes('ladenschluss') ||
    type.includes('laden-schluss')
  ) {
    return false
  }
  if (type.includes('büro') || type.includes('buero') || type.includes('office')) return false
  if (type.includes('frueh') || type.includes('früh') || type.includes('early') || type.includes('morgen')) return true
  return parseHHMMToMinutes(String(shift.start_time)) < 10 * 60
}
