import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import { mondayOfCalendarWeekBerlin } from './bwHolidayCalendar.js'
import type { GermanState } from '../data/germanHolidays2026.js'
import { listMonthHourLimitViolations, type MonthHourLimitViolation } from './employeePlannedHoursService.js'
import { getStationFederalState } from './stationExtraHolidayService.js'
import { listConflicts, listShifts, type ShiftRow } from './shiftService.js'

function nowIso(): string {
  return new Date().toISOString()
}

function ymdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysToYmd(ymd: string, n: number): string {
  const [y, mo, da] = ymd.split('-').map(Number)
  const d = new Date(y, mo - 1, da + n)
  return ymdFromDate(d)
}

function weekRangeFromMonday(weekMondayIso: string): { from: string; to: string } {
  const mon = new Date(`${weekMondayIso}T12:00:00`)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  return { from: weekMondayIso, to: ymdFromDate(sun) }
}

function isoCalendarWeekFromMondayYmd(mondayYmd: string): { year: number; calendarWeek: number } {
  const [y, m, d] = mondayYmd.split('-').map(Number)
  const mon = new Date(y, m - 1, d)
  mon.setHours(12, 0, 0, 0)
  const thu = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 3)
  thu.setHours(12, 0, 0, 0)
  const year = thu.getFullYear()
  const firstThursday = new Date(year, 0, 4)
  const offset = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(4 - offset)
  const diffDays = Math.round((thu.getTime() - firstThursday.getTime()) / 86400000)
  const week = 1 + Math.floor(diffDays / 7)
  return { year, calendarWeek: week }
}

export type WeekPublicationRow = {
  id: string
  station_id: string
  year: number
  calendar_week: number
  week_start_date: string
  week_end_date: string
  status: 'draft' | 'published'
  published_at: string | null
  published_by_user_id: string | null
  unpublished_at: string | null
  unpublished_by_user_id: string | null
  has_unpublished_changes: number
  created_at: string
  updated_at: string
}

export type WeekPublicationApi = {
  weekStart: string
  weekEnd: string
  calendarWeek: number
  year: number
  status: 'draft' | 'published'
  publishedAt: string | null
  publishedByUserId: string | null
  publishedByDisplayName: string | null
  hasUnpublishedChanges: boolean
}

function rowToApi(db: Database, row: WeekPublicationRow | undefined, weekMonday: string): WeekPublicationApi {
  const { from, to } = weekRangeFromMonday(weekMonday)
  const { year, calendarWeek } = isoCalendarWeekFromMondayYmd(weekMonday)
  if (!row) {
    return {
      weekStart: from,
      weekEnd: to,
      calendarWeek,
      year,
      status: 'draft',
      publishedAt: null,
      publishedByUserId: null,
      publishedByDisplayName: null,
      hasUnpublishedChanges: false,
    }
  }
  let publishedByDisplayName: string | null = null
  if (row.published_by_user_id) {
    const u = db
      .prepare(`SELECT display_name, username FROM users WHERE id = ?`)
      .get(row.published_by_user_id) as { display_name: string | null; username: string | null } | undefined
    publishedByDisplayName =
      String(u?.display_name ?? '').trim() || String(u?.username ?? '').trim() || null
  }
  return {
    weekStart: row.week_start_date,
    weekEnd: row.week_end_date,
    calendarWeek: row.calendar_week,
    year: row.year,
    status: row.status === 'published' ? 'published' : 'draft',
    publishedAt: row.published_at,
    publishedByUserId: row.published_by_user_id,
    publishedByDisplayName,
    hasUnpublishedChanges: (row.has_unpublished_changes ?? 0) === 1,
  }
}

export function getWeekPublicationRow(
  db: Database,
  stationId: string,
  weekMondayIso: string,
): WeekPublicationRow | undefined {
  const sid = String(stationId ?? '').trim()
  const mon = String(weekMondayIso ?? '').trim()
  if (!sid || !mon) return undefined
  return db
    .prepare(
      `SELECT * FROM weekly_schedule_publications WHERE station_id = ? AND week_start_date = ?`,
    )
    .get(sid, mon) as WeekPublicationRow | undefined
}

export function getWeekPublication(db: Database, stationId: string, weekMondayIso: string): WeekPublicationApi {
  const mon = mondayOfCalendarWeekBerlin(weekMondayIso)
  const row = getWeekPublicationRow(db, stationId, mon)
  return rowToApi(db, row, mon)
}

export function isWeekPublishedForStation(db: Database, stationId: string, dateYmd: string): boolean {
  const mon = mondayOfCalendarWeekBerlin(dateYmd)
  const row = getWeekPublicationRow(db, stationId, mon)
  return row?.status === 'published'
}

export function markWeekHasUnpublishedChangesIfPublished(
  db: Database,
  stationId: string,
  dateYmd: string,
): void {
  const sid = String(stationId ?? '').trim()
  if (!sid || !dateYmd) return
  const mon = mondayOfCalendarWeekBerlin(dateYmd)
  const row = getWeekPublicationRow(db, sid, mon)
  if (!row || row.status !== 'published') return
  const ts = nowIso()
  db.prepare(
    `UPDATE weekly_schedule_publications SET has_unpublished_changes = 1, updated_at = ? WHERE id = ?`,
  ).run(ts, row.id)
}

function ensurePublicationRow(db: Database, stationId: string, weekMondayIso: string): WeekPublicationRow {
  const existing = getWeekPublicationRow(db, stationId, weekMondayIso)
  if (existing) return existing
  const { from, to } = weekRangeFromMonday(weekMondayIso)
  const { year, calendarWeek } = isoCalendarWeekFromMondayYmd(weekMondayIso)
  const id = `wsp-${randomUUID()}`
  const ts = nowIso()
  db.prepare(
    `INSERT INTO weekly_schedule_publications (
      id, station_id, year, calendar_week, week_start_date, week_end_date,
      status, published_at, published_by_user_id, unpublished_at, unpublished_by_user_id,
      has_unpublished_changes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, NULL, NULL, 0, ?, ?)`,
  ).run(id, stationId, year, calendarWeek, from, to, ts, ts)
  return getWeekPublicationRow(db, stationId, weekMondayIso)!
}

export type WeekPublishSummary = {
  shiftCount: number
  openShiftCount: number
  employeesWithShifts: number
  conflictCount: number
  monthHourLimitViolationCount: number
  monthHourLimitViolations: MonthHourLimitViolation[]
}

export function getWeekPublishSummary(
  db: Database,
  stationId: string,
  weekMondayIso: string,
): WeekPublishSummary {
  const { from, to } = weekRangeFromMonday(weekMondayIso)
  const shifts = listShifts(db, { stationId, from, to })
  const assigned = shifts.filter((s) => s.employeeId && s.shiftType !== 'frei')
  const open = shifts.filter((s) => !s.employeeId && s.shiftType !== 'frei')
  const empIds = new Set(assigned.map((s) => s.employeeId).filter(Boolean))
  const conflicts = listConflicts(db, stationId, { from, to })
  const federalState = getStationFederalState(db, stationId) as GermanState
  const monthHourLimitViolations = listMonthHourLimitViolations(db, stationId, weekMondayIso, federalState)
  return {
    shiftCount: shifts.filter((s) => s.shiftType !== 'frei').length,
    openShiftCount: open.length,
    employeesWithShifts: empIds.size,
    conflictCount: conflicts.length,
    monthHourLimitViolationCount: monthHourLimitViolations.length,
    monthHourLimitViolations,
  }
}

function assertNoMonthHourLimitViolations(db: Database, stationId: string, weekMondayIso: string): void {
  const federalState = getStationFederalState(db, stationId) as GermanState
  const violations = listMonthHourLimitViolations(db, stationId, weekMondayIso, federalState)
  if (!violations.length) return
  const lines = violations.map(
    (v) =>
      `${v.displayName} überschreitet Monatslimit: ${v.plannedHours.toFixed(2).replace('.', ',')} / ${v.maxHours.toFixed(2).replace('.', ',')} Std.`,
  )
  throw new Error(
    `Veröffentlichung blockiert: ${violations.length} Mitarbeiter über dem maximalen Monatsstunden-Limit.\n${lines.join('\n')}`,
  )
}

export function publishWeekSchedule(
  db: Database,
  stationId: string,
  weekMondayIso: string,
  publishedByUserId: string | null,
): WeekPublicationApi {
  const sid = String(stationId ?? '').trim()
  const mon = mondayOfCalendarWeekBerlin(weekMondayIso)
  if (!sid || !mon) throw new Error('stationId und weekMonday erforderlich')
  assertNoMonthHourLimitViolations(db, sid, mon)
  ensurePublicationRow(db, sid, mon)
  const ts = nowIso()
  db.prepare(
    `UPDATE weekly_schedule_publications SET
      status = 'published',
      published_at = ?,
      published_by_user_id = ?,
      unpublished_at = NULL,
      unpublished_by_user_id = NULL,
      has_unpublished_changes = 0,
      updated_at = ?
    WHERE station_id = ? AND week_start_date = ?`,
  ).run(ts, publishedByUserId, ts, sid, mon)
  return getWeekPublication(db, sid, mon)
}

export function republishWeekSchedule(
  db: Database,
  stationId: string,
  weekMondayIso: string,
  publishedByUserId: string | null,
): WeekPublicationApi {
  return publishWeekSchedule(db, stationId, weekMondayIso, publishedByUserId)
}

export function unpublishWeekSchedule(
  db: Database,
  stationId: string,
  weekMondayIso: string,
  unpublishedByUserId: string | null,
): WeekPublicationApi {
  const sid = String(stationId ?? '').trim()
  const mon = mondayOfCalendarWeekBerlin(weekMondayIso)
  if (!sid || !mon) throw new Error('stationId und weekMonday erforderlich')
  ensurePublicationRow(db, sid, mon)
  const ts = nowIso()
  db.prepare(
    `UPDATE weekly_schedule_publications SET
      status = 'draft',
      unpublished_at = ?,
      unpublished_by_user_id = ?,
      has_unpublished_changes = 0,
      updated_at = ?
    WHERE station_id = ? AND week_start_date = ?`,
  ).run(ts, unpublishedByUserId, ts, sid, mon)
  return getWeekPublication(db, sid, mon)
}
