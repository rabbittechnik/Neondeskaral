import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { nowIso } from '../utils/timestamps.js'

export type TaskTemplateRow = {
  id: string
  station_id: string
  template_key: string
  title: string
  description: string | null
  category: string | null
  template_type: string
  frequency_type: string | null
  applies_every_shift: number | null
  applies_early_shift: number | null
  applies_late_shift: number | null
  weekend_sat_only: number | null
  weekend_sun_only: number | null
  applies_to_weekdays_json: string | null
  only_weekend: number | null
  is_required: number | null
  required_for_shift_close: number | null
  remark_required_if_not_done: number | null
  dynamic_assignment: number | null
  max_per_year: number | null
  max_per_month: number | null
  max_per_week: number | null
  tasks_per_shift: number | null
  active: number | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
  archived_at: string | null
}

export type TaskTemplateApi = {
  id: string
  stationId: string
  templateKey: string
  title: string
  description: string
  category: string
  templateType: string
  frequencyType: string
  appliesEveryShift: boolean
  appliesEarlyShift: boolean
  appliesLateShift: boolean
  weekendSatOnly: boolean
  weekendSunOnly: boolean
  appliesToWeekdays: number[]
  onlyWeekend: boolean
  isRequired: boolean
  requiredForShiftClose: boolean
  remarkRequiredIfNotDone: boolean
  dynamicAssignment: boolean
  maxPerYear: number | null
  maxPerMonth: number | null
  maxPerWeek: number | null
  tasksPerShift: number | null
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

function rowToApi(r: TaskTemplateRow): TaskTemplateApi {
  let weekdays: number[] = []
  try {
    weekdays = r.applies_to_weekdays_json ? (JSON.parse(r.applies_to_weekdays_json) as number[]) : []
  } catch {
    weekdays = []
  }
  return {
    id: r.id,
    stationId: r.station_id,
    templateKey: r.template_key,
    title: r.title,
    description: r.description ?? '',
    category: r.category ?? '',
    templateType: r.template_type,
    frequencyType: r.frequency_type ?? 'every_shift',
    appliesEveryShift: (r.applies_every_shift ?? 0) === 1,
    appliesEarlyShift: (r.applies_early_shift ?? 1) === 1,
    appliesLateShift: (r.applies_late_shift ?? 1) === 1,
    weekendSatOnly: (r.weekend_sat_only ?? 0) === 1,
    weekendSunOnly: (r.weekend_sun_only ?? 0) === 1,
    appliesToWeekdays: weekdays,
    onlyWeekend: (r.only_weekend ?? 0) === 1,
    isRequired: (r.is_required ?? 0) === 1,
    requiredForShiftClose: (r.required_for_shift_close ?? 0) === 1,
    remarkRequiredIfNotDone: (r.remark_required_if_not_done ?? 0) === 1,
    dynamicAssignment: (r.dynamic_assignment ?? 1) === 1,
    maxPerYear: r.max_per_year != null ? Number(r.max_per_year) : null,
    maxPerMonth: r.max_per_month != null ? Number(r.max_per_month) : null,
    maxPerWeek: r.max_per_week != null ? Number(r.max_per_week) : null,
    tasksPerShift: r.tasks_per_shift != null ? Number(r.tasks_per_shift) : null,
    active: (r.active ?? 1) === 1,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
    archivedAt: r.archived_at ?? undefined,
  }
}

export function listTaskTemplates(db: Database, stationId: string, templateType?: string): TaskTemplateApi[] {
  const sid = String(stationId ?? '').trim()
  if (!sid) return []
  let sql = `SELECT * FROM task_templates WHERE station_id = ? AND (archived_at IS NULL OR trim(archived_at) = '')`
  const params: string[] = [sid]
  if (templateType?.trim()) {
    sql += ` AND template_type = ?`
    params.push(templateType.trim())
  }
  sql += ` ORDER BY sort_order ASC, title ASC`
  const rows = db.prepare(sql).all(...params) as TaskTemplateRow[]
  return rows.map(rowToApi)
}

export function getTaskTemplateById(db: Database, id: string): TaskTemplateApi | undefined {
  const r = db.prepare(`SELECT * FROM task_templates WHERE id = ?`).get(id) as TaskTemplateRow | undefined
  return r ? rowToApi(r) : undefined
}

export function getTaskTemplateIdByKey(db: Database, stationId: string, templateKey: string): string | undefined {
  const r = db
    .prepare(`SELECT id FROM task_templates WHERE station_id = ? AND template_key = ?`)
    .get(stationId, templateKey) as { id: string } | undefined
  return r?.id
}

export type WeekendGeneratorSlice = {
  mandatory: { slug: string; title: string; category: string; yearlyCompletionCap: boolean }[]
  dynamicPool: { slug: string; title: string; category: string; yearlyCompletionCap: boolean }[]
}

/** Liest aktive Vorlagen für den Wochenend-Generator (Pflicht + Pool + Jahresaufgabe im Pool). */
export function loadWeekendGeneratorTemplates(db: Database, stationId: string): WeekendGeneratorSlice {
  const sid = String(stationId ?? '').trim()
  if (!sid) return { mandatory: [], dynamicPool: [] }
  const rows = db
    .prepare(
      `SELECT template_key, title, category, template_type, max_per_year, dynamic_assignment, active, only_weekend, is_required
       FROM task_templates
       WHERE station_id = ? AND active = 1 AND (archived_at IS NULL OR trim(archived_at) = '')
       ORDER BY sort_order ASC, title ASC`,
    )
    .all(sid) as {
    template_key: string
    title: string
    category: string | null
    template_type: string
    max_per_year: number | null
    dynamic_assignment: number | null
    active: number | null
    only_weekend: number | null
    is_required: number | null
  }[]

  const mandatory: WeekendGeneratorSlice['mandatory'] = []
  const dynamicPool: WeekendGeneratorSlice['dynamicPool'] = []

  for (const r of rows) {
    const slug = String(r.template_key).trim()
    if (!slug) continue
    const title = String(r.title).trim() || slug
    const category = String(r.category ?? '').trim() || 'Allgemein'
    const tt = String(r.template_type ?? '').trim()

    if (tt === 'daily' && (r.only_weekend ?? 0) === 1 && (r.is_required ?? 0) === 1) {
      mandatory.push({ slug, title, category, yearlyCompletionCap: false })
      continue
    }

    if (tt === 'weekend_dynamic' && (r.dynamic_assignment ?? 1) === 1) {
      dynamicPool.push({ slug, title, category, yearlyCompletionCap: false })
      continue
    }

    if (tt === 'yearly' && (r.dynamic_assignment ?? 1) === 1) {
      const cap = (r.max_per_year ?? 0) > 0
      dynamicPool.push({ slug, title, category, yearlyCompletionCap: cap })
    }
  }

  return { mandatory, dynamicPool }
}

export function getYearlyWindowCleaningCap(db: Database, stationId: string, fallbackMax: number): number {
  const row = db
    .prepare(
      `SELECT max_per_year FROM task_templates
       WHERE station_id = ? AND template_key = 'yearly_window_cleaning' AND active = 1
         AND (archived_at IS NULL OR trim(archived_at) = '')`,
    )
    .get(stationId) as { max_per_year: number | null } | undefined
  const n = row?.max_per_year != null ? Number(row.max_per_year) : NaN
  if (Number.isFinite(n)) return Math.min(20, Math.max(0, Math.floor(n)))
  return fallbackMax
}

type SeedDef = Omit<TaskTemplateRow, 'id' | 'created_at' | 'updated_at' | 'archived_at'> & {
  id?: string
}

function seedDefsForStation(stationId: string): SeedDef[] {
  const row = (p: Omit<SeedDef, 'station_id'>): SeedDef => ({ station_id: stationId, ...p })

  return [
    row({
      template_key: 'daily_outside_area_check',
      title: 'Außenbereich kontrollieren',
      template_type: 'daily',
      category: 'Außenbereich',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 1,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 1,
      is_required: 1,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 0,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 10,
    }),
    row({
      template_key: 'daily_bins_check',
      title: 'Mülleimer kontrollieren',
      template_type: 'daily',
      category: 'Reinigung',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 1,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 1,
      is_required: 1,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 0,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 20,
    }),
    row({
      template_key: 'weekend_candy_shelf',
      title: 'Süßigkeitenregal reinigen / ordentlich machen',
      template_type: 'weekend_dynamic',
      category: 'Regalpflege',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 100,
    }),
    row({
      template_key: 'weekend_coffee_corner',
      title: 'Kaffeeecke gründlich reinigen',
      template_type: 'weekend_dynamic',
      category: 'Reinigung',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 110,
    }),
    row({
      template_key: 'weekend_chips_wine_shelf',
      title: 'Chips- und Weinregal reinigen / ordentlich machen',
      template_type: 'weekend_dynamic',
      category: 'Regalpflege',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 120,
    }),
    row({
      template_key: 'weekend_fridges',
      title: 'Kühlschränke reinigen / kontrollieren',
      template_type: 'weekend_dynamic',
      category: 'Kontrolle',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 130,
    }),
    row({
      template_key: 'weekend_ice_freezer',
      title: 'Eistruhe reinigen / kontrollieren',
      template_type: 'weekend_dynamic',
      category: 'Kontrolle',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 140,
    }),
    row({
      template_key: 'weekend_lotto_corner',
      title: 'Lottoecke reinigen / ordentlich machen',
      template_type: 'weekend_dynamic',
      category: 'Reinigung',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 150,
    }),
    row({
      template_key: 'weekend_elfbar_corner',
      title: 'Elfbar-Ecke reinigen / ordentlich machen',
      template_type: 'weekend_dynamic',
      category: 'Reinigung',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 160,
    }),
    row({
      template_key: 'weekend_cash_area',
      title: 'Kassenbereich reinigen / ordentlich machen',
      template_type: 'weekend_dynamic',
      category: 'Reinigung',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 170,
    }),
    row({
      template_key: 'weekend_oven_cleaning',
      title: 'Backofen Reinigung',
      template_type: 'weekend_dynamic',
      category: 'Backshop',
      description: null,
      frequency_type: 'every_shift',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 0,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: null,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 180,
    }),
    row({
      template_key: 'yearly_window_cleaning',
      title: 'Fenster putzen',
      template_type: 'yearly',
      category: 'Reinigung',
      description: null,
      frequency_type: 'yearly',
      applies_every_shift: 0,
      applies_early_shift: 1,
      applies_late_shift: 1,
      weekend_sat_only: 0,
      weekend_sun_only: 0,
      applies_to_weekdays_json: null,
      only_weekend: 1,
      is_required: 0,
      required_for_shift_close: 0,
      remark_required_if_not_done: 0,
      dynamic_assignment: 1,
      max_per_year: 3,
      max_per_month: null,
      max_per_week: null,
      tasks_per_shift: null,
      active: 1,
      sort_order: 200,
    }),
  ]
}

/** Idempotent: je Station + template_key genau eine Zeile (INSERT OR IGNORE). */
export function seedTaskTemplatesIfMissing(db: Database) {
  const stations = db.prepare(`SELECT id FROM stations WHERE active = 1 OR active IS NULL`).all() as { id: string }[]
  const ts = nowIso()
  const ins = db.prepare(
    `INSERT OR IGNORE INTO task_templates (
      id, station_id, template_key, title, description, category, template_type, frequency_type,
      applies_every_shift, applies_early_shift, applies_late_shift, weekend_sat_only, weekend_sun_only,
      applies_to_weekdays_json, only_weekend, is_required, required_for_shift_close, remark_required_if_not_done,
      dynamic_assignment, max_per_year, max_per_month, max_per_week, tasks_per_shift, active, sort_order,
      created_at, updated_at, archived_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, NULL
    )`,
  )

  for (const { id: stationId } of stations) {
    for (const def of seedDefsForStation(stationId)) {
      const tid = def.id ?? `tpl-${stationId}-${def.template_key}`
      ins.run(
        tid,
        def.station_id,
        def.template_key,
        def.title,
        def.description,
        def.category,
        def.template_type,
        def.frequency_type,
        def.applies_every_shift ?? 0,
        def.applies_early_shift ?? 1,
        def.applies_late_shift ?? 1,
        def.weekend_sat_only ?? 0,
        def.weekend_sun_only ?? 0,
        def.applies_to_weekdays_json,
        def.only_weekend ?? 0,
        def.is_required ?? 0,
        def.required_for_shift_close ?? 0,
        def.remark_required_if_not_done ?? 0,
        def.dynamic_assignment ?? 0,
        def.max_per_year,
        def.max_per_month,
        def.max_per_week,
        def.tasks_per_shift,
        def.active ?? 1,
        def.sort_order ?? 0,
        ts,
        ts,
      )
    }
  }
}

export function updateTaskTemplate(
  db: Database,
  id: string,
  body: Record<string, unknown>,
  stationIdForAcl: string,
): TaskTemplateApi {
  const existing = db.prepare(`SELECT * FROM task_templates WHERE id = ?`).get(id) as TaskTemplateRow | undefined
  if (!existing) throw new Error('Vorlage nicht gefunden')
  if (existing.station_id !== stationIdForAcl) throw new Error('Vorlage gehört zu anderer Station')
  const ts = nowIso()

  const title = body.title != null ? String(body.title).trim() : existing.title
  if (!title) throw new Error('title erforderlich')

  const templateType = body.templateType != null ? String(body.templateType).trim() : existing.template_type
  const frequencyType =
    body.frequencyType != null ? String(body.frequencyType).trim() : (existing.frequency_type ?? 'every_shift')

  const bool = (v: unknown, d: number) => (v === true ? 1 : v === false ? 0 : d)

  db.prepare(
    `UPDATE task_templates SET
      title = ?, description = ?, category = ?, template_type = ?, frequency_type = ?,
      applies_every_shift = ?, applies_early_shift = ?, applies_late_shift = ?,
      weekend_sat_only = ?, weekend_sun_only = ?, applies_to_weekdays_json = ?,
      only_weekend = ?, is_required = ?, required_for_shift_close = ?, remark_required_if_not_done = ?,
      dynamic_assignment = ?, max_per_year = ?, max_per_month = ?, max_per_week = ?, tasks_per_shift = ?,
      active = ?, sort_order = ?, updated_at = ?
    WHERE id = ?`,
  ).run(
    title,
    body.description !== undefined ? String(body.description ?? '') : (existing.description ?? ''),
    body.category !== undefined ? String(body.category ?? '') : (existing.category ?? ''),
    templateType,
    frequencyType,
    body.appliesEveryShift != null ? bool(body.appliesEveryShift, existing.applies_every_shift ?? 0) : (existing.applies_every_shift ?? 0),
    body.appliesEarlyShift != null ? bool(body.appliesEarlyShift, existing.applies_early_shift ?? 1) : (existing.applies_early_shift ?? 1),
    body.appliesLateShift != null ? bool(body.appliesLateShift, existing.applies_late_shift ?? 1) : (existing.applies_late_shift ?? 1),
    body.weekendSatOnly != null ? bool(body.weekendSatOnly, existing.weekend_sat_only ?? 0) : (existing.weekend_sat_only ?? 0),
    body.weekendSunOnly != null ? bool(body.weekendSunOnly, existing.weekend_sun_only ?? 0) : (existing.weekend_sun_only ?? 0),
    body.appliesToWeekdays !== undefined
      ? body.appliesToWeekdays == null
        ? null
        : JSON.stringify(body.appliesToWeekdays)
      : existing.applies_to_weekdays_json,
    body.onlyWeekend != null ? bool(body.onlyWeekend, existing.only_weekend ?? 0) : (existing.only_weekend ?? 0),
    body.isRequired != null ? bool(body.isRequired, existing.is_required ?? 0) : (existing.is_required ?? 0),
    body.requiredForShiftClose != null
      ? bool(body.requiredForShiftClose, existing.required_for_shift_close ?? 0)
      : (existing.required_for_shift_close ?? 0),
    body.remarkRequiredIfNotDone != null
      ? bool(body.remarkRequiredIfNotDone, existing.remark_required_if_not_done ?? 0)
      : (existing.remark_required_if_not_done ?? 0),
    body.dynamicAssignment != null ? bool(body.dynamicAssignment, existing.dynamic_assignment ?? 0) : (existing.dynamic_assignment ?? 0),
    body.maxPerYear !== undefined
      ? body.maxPerYear == null
        ? null
        : Number(body.maxPerYear)
      : existing.max_per_year,
    body.maxPerMonth !== undefined
      ? body.maxPerMonth == null
        ? null
        : Number(body.maxPerMonth)
      : existing.max_per_month,
    body.maxPerWeek !== undefined
      ? body.maxPerWeek == null
        ? null
        : Number(body.maxPerWeek)
      : existing.max_per_week,
    body.tasksPerShift !== undefined
      ? body.tasksPerShift == null
        ? null
        : Number(body.tasksPerShift)
      : existing.tasks_per_shift,
    body.active != null ? bool(body.active, existing.active ?? 1) : (existing.active ?? 1),
    body.sortOrder != null ? Number(body.sortOrder) : (existing.sort_order ?? 0),
    ts,
    id,
  )

  const r = db.prepare(`SELECT * FROM task_templates WHERE id = ?`).get(id) as TaskTemplateRow
  return rowToApi(r)
}

export type TemplateYearStat = {
  templateKey: string
  title: string
  completedThisYear: number
  maxPerYear: number | null
  lastDoneDate: string | null
  lastDoneBy: string | null
}

export function yearlyTemplateCompletionStats(db: Database, stationId: string, year: number): TemplateYearStat[] {
  const sid = String(stationId ?? '').trim()
  if (!sid) return []
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const templates = db
    .prepare(
      `SELECT template_key, title, max_per_year FROM task_templates
       WHERE station_id = ? AND template_type = 'yearly' AND active = 1
         AND (archived_at IS NULL OR trim(archived_at) = '')`,
    )
    .all(sid) as { template_key: string; title: string; max_per_year: number | null }[]

  const out: TemplateYearStat[] = []
  for (const t of templates) {
    const key = String(t.template_key)
    const doneRow =
      key === 'yearly_window_cleaning'
        ? (db
            .prepare(
              `SELECT COUNT(*) as c FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug IN ('yearly_window_cleaning','fenster_putzen') AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?`,
            )
            .get(sid, from, to) as { c: number })
        : (db
            .prepare(
              `SELECT COUNT(*) as c FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug = ? AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?`,
            )
            .get(sid, key, from, to) as { c: number })
    const lastRow =
      key === 'yearly_window_cleaning'
        ? (db
            .prepare(
              `SELECT tl.date as d, tl.confirmed_by as b FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug IN ('yearly_window_cleaning','fenster_putzen') AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?
         ORDER BY tl.date DESC, tl.confirmed_at DESC LIMIT 1`,
            )
            .get(sid, from, to) as { d: string; b: string | null } | undefined)
        : (db
            .prepare(
              `SELECT tl.date as d, tl.confirmed_by as b FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug = ? AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?
         ORDER BY tl.date DESC, tl.confirmed_at DESC LIMIT 1`,
            )
            .get(sid, key, from, to) as { d: string; b: string | null } | undefined)
    out.push({
      templateKey: key,
      title: t.title,
      completedThisYear: doneRow?.c ?? 0,
      maxPerYear: t.max_per_year != null ? Number(t.max_per_year) : null,
      lastDoneDate: lastRow?.d ?? null,
      lastDoneBy: lastRow?.b ?? null,
    })
  }
  return out
}

export type TemplateAssignmentStat = {
  templateKey: string
  title: string
  lastAssignedAt: string | null
  lastAssignedEmployeeId: string | null
  lastCompletedAt: string | null
  completedThisYear: number
}

export function dynamicTemplateAssignmentStats(db: Database, stationId: string, year: number): TemplateAssignmentStat[] {
  const sid = String(stationId ?? '').trim()
  if (!sid) return []
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const keys = db
    .prepare(
      `SELECT template_key, title FROM task_templates
       WHERE station_id = ? AND template_type IN ('weekend_dynamic','yearly') AND active = 1
         AND (archived_at IS NULL OR trim(archived_at) = '')`,
    )
    .all(sid) as { template_key: string; title: string }[]

  const out: TemplateAssignmentStat[] = []
  for (const t of keys) {
    const key = String(t.template_key)
    const lastTask =
      key === 'yearly_window_cleaning'
        ? (db
            .prepare(
              `SELECT created_at, assigned_employee_id FROM tasks
         WHERE station_id = ? AND weekend_task_template_slug IN ('yearly_window_cleaning','fenster_putzen') AND task_kind = 'weekend_generated'
         ORDER BY created_at DESC LIMIT 1`,
            )
            .get(sid) as { created_at: string; assigned_employee_id: string | null } | undefined)
        : (db
            .prepare(
              `SELECT created_at, assigned_employee_id FROM tasks
         WHERE station_id = ? AND weekend_task_template_slug = ? AND task_kind = 'weekend_generated'
         ORDER BY created_at DESC LIMIT 1`,
            )
            .get(sid, key) as { created_at: string; assigned_employee_id: string | null } | undefined)
    const lastDone =
      key === 'yearly_window_cleaning'
        ? (db
            .prepare(
              `SELECT tl.confirmed_at as ca FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug IN ('yearly_window_cleaning','fenster_putzen') AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?
         ORDER BY tl.date DESC, tl.confirmed_at DESC LIMIT 1`,
            )
            .get(sid, from, to) as { ca: string | null } | undefined)
        : (db
            .prepare(
              `SELECT tl.confirmed_at as ca FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug = ? AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?
         ORDER BY tl.date DESC, tl.confirmed_at DESC LIMIT 1`,
            )
            .get(sid, key, from, to) as { ca: string | null } | undefined)
    const doneCount =
      key === 'yearly_window_cleaning'
        ? (db
            .prepare(
              `SELECT COUNT(*) as c FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug IN ('yearly_window_cleaning','fenster_putzen') AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?`,
            )
            .get(sid, from, to) as { c: number })
        : (db
            .prepare(
              `SELECT COUNT(*) as c FROM task_logs tl
         INNER JOIN tasks tk ON tk.id = tl.task_id
         WHERE tk.station_id = ? AND tk.weekend_task_template_slug = ? AND tl.status = 'done' AND tl.date >= ? AND tl.date <= ?`,
            )
            .get(sid, key, from, to) as { c: number })
    out.push({
      templateKey: key,
      title: t.title,
      lastAssignedAt: lastTask?.created_at ?? null,
      lastAssignedEmployeeId: lastTask?.assigned_employee_id ?? null,
      lastCompletedAt: lastDone?.ca ?? null,
      completedThisYear: doneCount?.c ?? 0,
    })
  }
  return out
}

export function insertTaskInstanceForTask(
  db: Database,
  opts: {
    taskId: string
    templateKey: string | null
    stationId: string
    employeeId: string | null
    shiftId: string | null
    date: string
    source: string
  },
) {
  const templateId =
    opts.templateKey != null && opts.templateKey.trim()
      ? getTaskTemplateIdByKey(db, opts.stationId, opts.templateKey.trim())
      : undefined
  const ts = nowIso()
  const id = `tinst-${randomUUID()}`
  db.prepare(
    `INSERT OR IGNORE INTO task_instances (
      id, task_id, template_id, station_id, employee_id, shift_id, date, status, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
  ).run(
    id,
    opts.taskId,
    templateId ?? null,
    opts.stationId,
    opts.employeeId,
    opts.shiftId,
    opts.date,
    opts.source,
    ts,
    ts,
  )
}
