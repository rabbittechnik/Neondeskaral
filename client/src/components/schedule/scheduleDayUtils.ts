import type { ResolvedShiftBlock, ShiftTypeId } from '../../data/mockSchedule'

export const DEFAULT_EMPLOYEE_SHIFT_ACCENT = '#22d3ee'

/** Reihenfolge: Früh → Mittel/Kurz/Schule/Sonderdienst/Konflikt → Spät → Nacht */
const TYPE_RANK: Partial<Record<ShiftTypeId, number>> = {
  frueh: 0,
  mittel: 1,
  kurz: 1,
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

export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.trim().replace('#', '')
  if (!raw) return `rgba(34, 211, 238, ${alpha})`
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6)
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(34, 211, 238, ${alpha})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}
