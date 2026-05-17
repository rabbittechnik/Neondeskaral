/** Erweiterte Farbpalette für Mitarbeiter (bestehende Presets bleiben enthalten). */

/** Ursprüngliche 12 Presets — Reihenfolge beibehalten. */
const LEGACY_PRESETS = [
  '#22d3ee',
  '#a3e635',
  '#f472b6',
  '#c084fc',
  '#fbbf24',
  '#38bdf8',
  '#34d399',
  '#fb923c',
  '#f43f5e',
  '#a78bfa',
  '#2dd4bf',
  '#eab308',
] as const

const EXTENDED_PRESETS = [
  '#14b8a6',
  '#06b6d4',
  '#67e8f9',
  '#3b82f6',
  '#2563eb',
  '#60a5fa',
  '#1e40af',
  '#1e3a8a',
  '#7c3aed',
  '#8b5cf6',
  '#9333ea',
  '#a855f7',
  '#d946ef',
  '#e879f9',
  '#ec4899',
  '#dc2626',
  '#ef4444',
  '#ea580c',
  '#f97316',
  '#facc15',
  '#ca8a04',
  '#16a34a',
  '#22c55e',
  '#4ade80',
  '#6ee7b7',
  '#0f766e',
  '#115e59',
  '#92400e',
  '#a16207',
  '#64748b',
  '#94a3b8',
  '#475569',
  '#334155',
  '#0e7490',
  '#0891b2',
  '#be185d',
  '#9d174d',
  '#65a30d',
  '#84cc16',
] as const

export type EmployeeColorPreset = { hex: string; label: string }

export const EMPLOYEE_COLOR_PRESET_ENTRIES: EmployeeColorPreset[] = [
  { hex: '#22d3ee', label: 'Türkis / Cyan' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#14b8a6', label: 'Türkis' },
  { hex: '#2dd4bf', label: 'Mint' },
  { hex: '#34d399', label: 'Mint hell' },
  { hex: '#38bdf8', label: 'Hellblau' },
  { hex: '#3b82f6', label: 'Blau' },
  { hex: '#2563eb', label: 'Blau kräftig' },
  { hex: '#60a5fa', label: 'Blau hell' },
  { hex: '#1e40af', label: 'Dunkelblau' },
  { hex: '#1e3a8a', label: 'Navy' },
  { hex: '#7c3aed', label: 'Violett' },
  { hex: '#8b5cf6', label: 'Violett hell' },
  { hex: '#9333ea', label: 'Lila' },
  { hex: '#a855f7', label: 'Lila hell' },
  { hex: '#c084fc', label: 'Flieder' },
  { hex: '#a78bfa', label: 'Lavendel' },
  { hex: '#d946ef', label: 'Magenta' },
  { hex: '#e879f9', label: 'Pink hell' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#f472b6', label: 'Rosa' },
  { hex: '#f43f5e', label: 'Rot-Rosa' },
  { hex: '#ef4444', label: 'Rot' },
  { hex: '#dc2626', label: 'Rot dunkel' },
  { hex: '#fb923c', label: 'Orange' },
  { hex: '#ea580c', label: 'Orange dunkel' },
  { hex: '#f97316', label: 'Orange hell' },
  { hex: '#fbbf24', label: 'Gold' },
  { hex: '#eab308', label: 'Gelb' },
  { hex: '#facc15', label: 'Gelb hell' },
  { hex: '#ca8a04', label: 'Gold dunkel' },
  { hex: '#a3e635', label: 'Lime' },
  { hex: '#84cc16', label: 'Grün hell' },
  { hex: '#4ade80', label: 'Grün' },
  { hex: '#22c55e', label: 'Grün kräftig' },
  { hex: '#16a34a', label: 'Grün dunkel' },
  { hex: '#0f766e', label: 'Petrol' },
  { hex: '#115e59', label: 'Petrol dunkel' },
  { hex: '#92400e', label: 'Braun' },
  { hex: '#a16207', label: 'Braun hell' },
  { hex: '#94a3b8', label: 'Grau' },
  { hex: '#64748b', label: 'Grau mittel' },
  { hex: '#475569', label: 'Dunkelgrau' },
  { hex: '#334155', label: 'Schiefer' },
] as const

function dedupeHexList(list: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const n = normalizeHexColor(raw)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/** Alle Preset-Hex-Werte (dedupliziert, Legacy zuerst). */
export const EMPLOYEE_COLOR_PRESETS: string[] = dedupeHexList([
  ...LEGACY_PRESETS,
  ...EXTENDED_PRESETS,
  ...EMPLOYEE_COLOR_PRESET_ENTRIES.map((p) => p.hex),
])

export function normalizeHexColor(input: string | null | undefined): string | null {
  const t = String(input ?? '').trim()
  if (!t) return null
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`
  return null
}

export function isValidHexColor(input: string | null | undefined): boolean {
  return normalizeHexColor(input) != null
}

export function colorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeHexColor(a)
  const nb = normalizeHexColor(b)
  return Boolean(na && nb && na === nb)
}

export type EmployeeColorUsage = {
  employeeId: string
  displayName: string
}

export function findEmployeesUsingColor(
  employees: { id: string; displayName?: string; color?: string; status?: string }[],
  color: string,
  excludeEmployeeId?: string,
): EmployeeColorUsage[] {
  const target = normalizeHexColor(color)
  if (!target) return []
  return employees
    .filter((e) => {
      if (excludeEmployeeId && e.id === excludeEmployeeId) return false
      if (e.status === 'geloescht') return false
      return colorsMatch(e.color, target)
    })
    .map((e) => ({
      employeeId: e.id,
      displayName: e.displayName?.trim() || 'Mitarbeiter',
    }))
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const toByte = (v: number) => Math.round((v + m) * 255)
  const pad = (n: number) => n.toString(16).padStart(2, '0')
  return `#${pad(toByte(r))}${pad(toByte(g))}${pad(toByte(b))}`
}

/** Nächste freie Preset-Farbe; keine Änderung an bestehenden Zuweisungen. */
export function suggestNextEmployeeColor(
  employees: { id: string; color?: string; status?: string }[],
  excludeEmployeeId?: string,
): string {
  const used = new Set<string>()
  for (const e of employees) {
    if (excludeEmployeeId && e.id === excludeEmployeeId) continue
    if (e.status === 'geloescht') continue
    const n = normalizeHexColor(e.color)
    if (n) used.add(n)
  }
  for (const c of EMPLOYEE_COLOR_PRESETS) {
    if (!used.has(c)) return c
  }
  for (let i = 0; i < 72; i++) {
    const hex = hslToHex((i * 47 + employees.length * 13) % 360, 0.72, 0.52)
    if (!used.has(hex)) return hex
  }
  return EMPLOYEE_COLOR_PRESETS[employees.length % EMPLOYEE_COLOR_PRESETS.length] ?? '#22d3ee'
}

/** Relative Helligkeit (WCAG) — für Text auf Vollfläche. */
export function getReadableTextColor(backgroundHex: string): '#ffffff' | '#0f172a' {
  const hex = normalizeHexColor(backgroundHex)
  if (!hex) return '#ffffff'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.42 ? '#0f172a' : '#ffffff'
}

export function presetLabelForHex(hex: string): string | undefined {
  const n = normalizeHexColor(hex)
  if (!n) return undefined
  return EMPLOYEE_COLOR_PRESET_ENTRIES.find((p) => colorsMatch(p.hex, n))?.label
}
