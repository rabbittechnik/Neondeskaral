import type { Database } from 'better-sqlite3'
import { addDaysToYmd } from '../utils/europeBerlinWallTime.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'
import { createTask } from './taskService.js'
import {
  getYearlyWindowCleaningCap,
  insertTaskInstanceForTask,
  loadWeekendGeneratorTemplates,
  type WeekendGeneratorSlice,
} from './taskTemplateService.js'

export type WeekendTaskTemplateDef = {
  slug: string
  title: string
  category: string
  /** „Fenster putzen“: max. Erledigungen pro Jahr (Zählung über task_logs). */
  yearlyCompletionCap: boolean
}

const TASK_KIND = 'weekend_generated'

/** Fallback nur wenn noch keine Vorlagen in der DB (z. B. frische Installation vor Schema). */
const LEGACY_MANDATORY: WeekendTaskTemplateDef[] = [
  {
    slug: 'daily_outside_area_check',
    title: 'Außenbereich kontrollieren',
    category: 'Außenbereich',
    yearlyCompletionCap: false,
  },
  {
    slug: 'daily_bins_check',
    title: 'Mülleimer kontrollieren',
    category: 'Reinigung',
    yearlyCompletionCap: false,
  },
]

const LEGACY_DYNAMIC_POOL: WeekendTaskTemplateDef[] = [
  { slug: 'weekend_candy_shelf', title: 'Süßigkeitenregal reinigen / ordentlich machen', category: 'Regalpflege', yearlyCompletionCap: false },
  { slug: 'weekend_coffee_corner', title: 'Kaffeeecke gründlich reinigen', category: 'Reinigung', yearlyCompletionCap: false },
  { slug: 'weekend_chips_wine_shelf', title: 'Chips- und Weinregal reinigen / ordentlich machen', category: 'Regalpflege', yearlyCompletionCap: false },
  { slug: 'weekend_fridges', title: 'Kühlschränke reinigen / kontrollieren', category: 'Kontrolle', yearlyCompletionCap: false },
  { slug: 'weekend_ice_freezer', title: 'Eistruhe reinigen / kontrollieren', category: 'Kontrolle', yearlyCompletionCap: false },
  { slug: 'weekend_lotto_corner', title: 'Lottoecke reinigen / ordentlich machen', category: 'Reinigung', yearlyCompletionCap: false },
  { slug: 'weekend_elfbar_corner', title: 'Elfbar-Ecke reinigen / ordentlich machen', category: 'Reinigung', yearlyCompletionCap: false },
  { slug: 'weekend_cash_area', title: 'Kassenbereich reinigen / ordentlich machen', category: 'Reinigung', yearlyCompletionCap: false },
  { slug: 'weekend_oven_cleaning', title: 'Backofen Reinigung', category: 'Backshop', yearlyCompletionCap: false },
  { slug: 'yearly_window_cleaning', title: 'Fenster putzen', category: 'Reinigung', yearlyCompletionCap: true },
]

function parseHHMMToMinutes(t: string): number {
  const [h, m] = String(t ?? '').split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function isMorningWeekendShift(row: ShiftRow): boolean {
  const rawType = String(row.shift_type ?? '').toLowerCase()
  if (rawType.includes('spaet') || rawType.includes('spät') || rawType.includes('late')) return false
  if (rawType.includes('frueh') || rawType.includes('früh') || rawType.includes('early')) return true
  return parseHHMMToMinutes(String(row.start_time)) < 14 * 60
}

function compareWeekendShifts(a: ShiftRow, b: ShiftRow): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  const amA = isMorningWeekendShift(a) ? 0 : 1
  const amB = isMorningWeekendShift(b) ? 0 : 1
  if (amA !== amB) return amA - amB
  return parseHHMMToMinutes(a.start_time) - parseHHMMToMinutes(b.start_time)
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function countFensterCompletionsInYear(db: Database, stationId: string, year: number): number {
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM task_logs tl
       INNER JOIN tasks t ON t.id = tl.task_id
       WHERE t.station_id = ? AND t.weekend_task_template_slug IN ('yearly_window_cleaning','fenster_putzen')
         AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?`,
    )
    .get(stationId, from, to) as { c: number } | undefined
  return row?.c ?? 0
}

function lastDynamicSlugForEmployee(db: Database, stationId: string, employeeId: string): string | null {
  const row = db
    .prepare(
      `SELECT weekend_task_template_slug as s FROM tasks
       WHERE station_id = ? AND assigned_employee_id = ? AND task_kind = ?
         AND weekend_task_template_slug IS NOT NULL
         AND weekend_task_template_slug NOT IN ('daily_outside_area_check','daily_bins_check','pflicht_aussenbereich','pflicht_muell')
       ORDER BY start_date DESC, created_at DESC LIMIT 1`,
    )
    .get(stationId, employeeId, TASK_KIND) as { s: string } | undefined
  return row?.s ? String(row.s) : null
}

function weekendTaskExists(db: Database, stationId: string, shiftId: string, slug: string): boolean {
  const hit = db
    .prepare(
      `SELECT 1 as x FROM tasks WHERE station_id = ? AND source_shift_id = ? AND weekend_task_template_slug = ? LIMIT 1`,
    )
    .get(stationId, shiftId, slug) as { x: number } | undefined
  return Boolean(hit)
}

function resolveTemplates(db: Database, stationId: string): WeekendGeneratorSlice {
  const fromDb = loadWeekendGeneratorTemplates(db, stationId)
  if (fromDb.mandatory.length || fromDb.dynamicPool.length) return fromDb
  return { mandatory: [...LEGACY_MANDATORY], dynamicPool: [...LEGACY_DYNAMIC_POOL] }
}

function upsertWeekendTask(
  db: Database,
  stationId: string,
  shift: ShiftRow,
  def: WeekendTaskTemplateDef,
  mandatory: boolean,
) {
  if (weekendTaskExists(db, stationId, shift.id, def.slug)) return
  const emp = String(shift.employee_id ?? '').trim()
  if (!emp) return
  const date = String(shift.date).trim()
  const created = createTask(
    db,
    {
      title: def.title,
      description: `Kategorie: ${def.category}`,
      workAreaId: shift.work_area_id,
      assignedType: 'employee',
      assignedEmployeeId: emp,
      recurrenceType: 'once',
      startDate: date,
      endDate: date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      mandatory,
      taskKind: TASK_KIND,
      employeeSelfService: true,
      assignedShiftType: String(shift.shift_type ?? '').trim() || undefined,
      createdBy: 'weekend_task_generator',
      sourceShiftId: shift.id,
      weekendTaskTemplateSlug: def.slug,
      taskCategory: def.category,
    },
    stationId,
  )
  if (created?.id) {
    insertTaskInstanceForTask(db, {
      taskId: created.id,
      templateKey: def.slug,
      stationId,
      employeeId: emp,
      shiftId: shift.id,
      date,
      source: 'weekend_generator',
    })
  }
}

export type WeekendTaskGenSummary = {
  stationId: string
  weekStartMonday: string
  shiftsConsidered: number
  tasksCreated: number
  skippedDisabled: boolean
}

function loadWeekendSettings(db: Database, stationId: string) {
  const row = db
    .prepare(`SELECT enabled, dynamic_tasks_per_weekend_shift, max_fenster_auto_per_year FROM station_weekend_task_settings WHERE station_id = ?`)
    .get(stationId) as
    | { enabled: number | null; dynamic_tasks_per_weekend_shift: number | null; max_fenster_auto_per_year: number | null }
    | undefined
  const enabled = row == null || (row.enabled ?? 1) === 1
  const per = Math.min(2, Math.max(1, Number(row?.dynamic_tasks_per_weekend_shift ?? 2) || 2))
  const maxFen = Math.min(10, Math.max(0, Number(row?.max_fenster_auto_per_year ?? 3) || 3))
  return { enabled, dynamicPerShift: per, maxFensterPerYear: maxFen }
}

/**
 * Idempotent: je (station_id, shift_id, weekend_task_template_slug) höchstens eine Aufgabe.
 * Pflichtaufgaben pro Wochenend-Schicht; 1–2 dynamische Zusatzaufgaben; „Fenster putzen“ nur bei Jahres-Kontingent (Vorlage max_per_year / Stations-Fallback).
 */
export function generateDynamicWeekendTasks(db: Database, stationId: string, weekStartMonday: string): WeekendTaskGenSummary {
  const sid = String(stationId ?? '').trim()
  const mon = /^\d{4}-\d{2}-\d{2}$/.test(weekStartMonday) ? weekStartMonday : null
  if (!sid || !mon) {
    return { stationId: sid, weekStartMonday: mon ?? '', shiftsConsidered: 0, tasksCreated: 0, skippedDisabled: true }
  }
  const settings = loadWeekendSettings(db, sid)
  if (!settings.enabled) {
    return { stationId: sid, weekStartMonday: mon, shiftsConsidered: 0, tasksCreated: 0, skippedDisabled: true }
  }
  const sat = addDaysToYmd(mon, 5)
  const sun = addDaysToYmd(mon, 6)
  const year = Number(mon.slice(0, 4))
  const fensterCap = getYearlyWindowCleaningCap(db, sid, settings.maxFensterPerYear)
  const fensterDone = countFensterCompletionsInYear(db, sid, year)
  const { mandatory: MANDATORY, dynamicPool: DYNAMIC_POOL } = resolveTemplates(db, sid)

  const rows = listShiftRowsForStationDateRange(db, sid, sat, sun).filter(
    (s) => (s.published ?? 0) === 1 && String(s.employee_id ?? '').trim() && String(s.shift_type ?? '').toLowerCase() !== 'frei',
  )
  rows.sort(compareWeekendShifts)

  let created = 0
  const rand = mulberry32(hashString(`${sid}|${mon}|weekend-tasks-v2`))
  const poolBase = DYNAMIC_POOL.filter((t) => !t.yearlyCompletionCap || fensterDone < fensterCap)
  const globalUsedSlugs = new Set<string>()

  for (const shift of rows) {
    for (const m of MANDATORY) {
      const before = weekendTaskExists(db, sid, shift.id, m.slug)
      upsertWeekendTask(db, sid, shift, m, true)
      if (!before && weekendTaskExists(db, sid, shift.id, m.slug)) created += 1
    }

    const picks: WeekendTaskTemplateDef[] = []
    const emp = String(shift.employee_id ?? '').trim()
    const shuffled = shuffle(poolBase, rand)
    const avoidSlug = lastDynamicSlugForEmployee(db, sid, emp)
    const hasAlternativeToAvoid = Boolean(avoidSlug && poolBase.some((x) => x.slug !== avoidSlug))
    for (const cand of shuffled) {
      if (picks.length >= settings.dynamicPerShift) break
      if (globalUsedSlugs.has(cand.slug)) continue
      if (picks.length === 0 && cand.slug === avoidSlug && hasAlternativeToAvoid) continue
      picks.push(cand)
      globalUsedSlugs.add(cand.slug)
    }
    if (picks.length < settings.dynamicPerShift) {
      for (const cand of shuffled) {
        if (picks.length >= settings.dynamicPerShift) break
        if (globalUsedSlugs.has(cand.slug)) continue
        picks.push(cand)
        globalUsedSlugs.add(cand.slug)
      }
    }

    for (const p of picks) {
      const before = weekendTaskExists(db, sid, shift.id, p.slug)
      upsertWeekendTask(db, sid, shift, p, false)
      if (!before && weekendTaskExists(db, sid, shift.id, p.slug)) created += 1
    }
  }

  return {
    stationId: sid,
    weekStartMonday: mon,
    shiftsConsidered: rows.length,
    tasksCreated: created,
    skippedDisabled: false,
  }
}
