import type { ResolvedShiftBlock, ShiftTypeId } from '../../data/mockSchedule'

export const DEFAULT_EMPLOYEE_SHIFT_ACCENT = '#22d3ee'

/** Reihenfolge: Früh → Mittel/Kurz/Schule/Sonderdienst/Konflikt → Spät → Nacht */
const TYPE_RANK: Partial<Record<ShiftTypeId, number>> = {
  frueh: 0,
  mittel: 1,
  kurz: 1,
  regular: 1,
  schule: 1,
  sonderdienst: 1,
  konflikt: 1,
  spaet: 2,
  nacht: 3,
  frei: 99,
}

export function shiftTypeSortRank(type: ShiftTypeId): number {
  return TYPE_RANK[type] ?? 1
}

function startMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return 0
  return h * 60 + (m || 0)
}

export function sortBlocksForDay(blocks: ResolvedShiftBlock[]): ResolvedShiftBlock[] {
  return [...blocks].sort((a, b) => {
    const ra = shiftTypeSortRank(a.type)
    const rb = shiftTypeSortRank(b.type)
    if (ra !== rb) return ra - rb
    return startMinutes(a.start) - startMinutes(b.start)
  })
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace('#', '')
  if (!raw) return null
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6)
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHexRgb(hex)
  if (!rgb) return `rgba(34, 211, 238, ${alpha})`
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`
}

/** Mischt Hex-Farbe Richtung Schwarz (0–1), für kräftige Balken-Verläufe. */
export function darkenHex(hex: string, amount = 0.28): string {
  const rgb = parseHexRgb(hex)
  if (!rgb) return '#0f172a'
  const t = Math.min(1, Math.max(0, amount))
  const r = Math.round(rgb.r * (1 - t))
  const g = Math.round(rgb.g * (1 - t))
  const b = Math.round(rgb.b * (1 - t))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/** Leichter Aufheller für Verlauf-Highlights. */
export function lightenHex(hex: string, amount = 0.18): string {
  const rgb = parseHexRgb(hex)
  if (!rgb) return '#ffffff'
  const t = Math.min(1, Math.max(0, amount))
  const mix = (c: number) => Math.round(c + (255 - c) * t)
  const r = mix(rgb.r)
  const g = mix(rgb.g)
  const b = mix(rgb.b)
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
