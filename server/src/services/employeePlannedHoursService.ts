import type { Database } from 'better-sqlite3'
import type { GermanState } from '../data/germanHolidays2026.js'
import { getHolidayBadgeForDate } from '../data/germanHolidays2026.js'
import type { AbsenceRow } from './absenceService.js'
import { listShiftRowsForStationDateRange, type ShiftRow } from './shiftService.js'

export type EmployeePlannedHoursBreakdown = {
  employeeId: string
  employeeName: string
  rangeStart: string
  rangeEnd: string
  plannedShiftHours: number
  paidVacationHours: number
  totalHours: number
}

const APPROVED_ABSENCE_STATUSES = new Set(['approved', 'genehmigt', 'erfasst', 'recorded'])

function maxYmd(a: string, b: string): string {
  return a > b ? a : b
}

function minYmd(a: string, b: string): string {
  return a < b ? a : b
}

function enumerateDatesInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = []
  const d = new Date(`${fromYmd}T12:00:00`)
  const end = new Date(`${toYmd}T12:00:00`)
  while (d <= end) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${day}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function calendarMonthRangeFromYmd(containedYmd: string): { from: string; to: string } {
  const d = new Date(`${containedYmd}T12:00:00`)
  const y = d.getFullYear()
  const m = d.getMonth()
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = `${y}-${pad(m + 1)}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const to = `${y}-${pad(m + 1)}-${pad(lastDay)}`
  return { from, to }
}

function timeToMinutes(t: string): number {
  const raw = String(t ?? '').trim()
  const short = raw.length >= 5 ? raw.slice(0, 5) : raw
  const [h, mi] = short.split(':').map(Number)
  return (Number.isFinite(h) ? h! : 0) * 60 + (Number.isFinite(mi) ? mi! : 0)
}

function netPlannedHoursForShiftRow(r: ShiftRow): number {
  if (!r.start_time || !r.end_time) return 0
  if (String(r.shift_type ?? '').trim() === 'frei') return 0
  const sm = timeToMinutes(r.start_time)
  let em = timeToMinutes(r.end_time)
  if (em <= sm) em += 24 * 60
  const gross = (em - sm) / 60
  const br = (r.break_minutes ?? 0) / 60
  return Math.max(0, Math.round((gross - br) * 10) / 10)
}

function excludePublicHolidayFromPaidVacationCredits(employmentType: string): boolean {
  const t = String(employmentType ?? '').toLowerCase()
  return t !== 'minijob' && t !== 'aushilfe'
}

function defaultFullDayVacationHours(a: AbsenceRow): number {
  if (a.paid_hours_per_day != null && a.paid_hours_per_day > 0) return a.paid_hours_per_day
  return 8
}

function vacationHoursForCalendarDay(a: AbsenceRow, ymd: string): number {
  const full = defaultFullDayVacationHours(a)
  const half = (a.half_day ?? 0) === 1
  if (a.start_date === a.end_date && half) return full / 2
  if (half && ymd === a.start_date) return full / 2
  return full
}

function absenceApprovedForHourCredit(status: string): boolean {
  return APPROVED_ABSENCE_STATUSES.has(String(status ?? '').toLowerCase())
}

function normalizePaidVacationType(type: string): boolean {
  const t = String(type ?? '').toLowerCase()
  return t === 'paid_vacation' || t === 'urlaub' || t === 'vacation'
}

/**
 * Geplante Nettostunden inkl. bezahltem Urlaub — gleiche Logik wie client `employeePlannedHours.ts`.
 * Bezahlter Urlaub ersetzt Schicht am selben Tag (keine Doppelzählung).
 */
export function calculateEmployeePlannedHoursFromRows(
  employeeId: string,
  shiftRows: ShiftRow[],
  absenceRows: AbsenceRow[],
  employmentType: string,
  federalState: GermanState,
  rangeStart: string,
  rangeEnd: string,
): EmployeePlannedHoursBreakdown {
  const shiftByDay = new Map<string, number>()
  for (const r of shiftRows) {
    if (r.employee_id !== employeeId) continue
    if (!r.employee_id) continue
    if (r.date < rangeStart || r.date > rangeEnd) continue
    const h = netPlannedHoursForShiftRow(r)
    if (h <= 0) continue
    shiftByDay.set(r.date, (shiftByDay.get(r.date) ?? 0) + h)
  }

  const vacationByDay = new Map<string, number>()
  for (const a of absenceRows) {
    if (a.employee_id !== employeeId) continue
    if (!normalizePaidVacationType(a.type)) continue
    if (!absenceApprovedForHourCredit(a.status)) continue
    if ((a.paid ?? 1) === 0) continue

    const start = maxYmd(a.start_date, rangeStart)
    const end = minYmd(a.end_date, rangeEnd)
    if (start > end) continue

    const dayCap = defaultFullDayVacationHours(a)
    for (const d of enumerateDatesInclusive(start, end)) {
      if (excludePublicHolidayFromPaidVacationCredits(employmentType)) {
        if (getHolidayBadgeForDate(d, federalState).severity === 'strong') continue
      }
      const hrs = vacationHoursForCalendarDay(a, d)
      const prev = vacationByDay.get(d) ?? 0
      vacationByDay.set(d, Math.min(dayCap, prev + hrs))
    }
  }

  let rawPaidVacation = 0
  let rawPlannedShift = 0
  for (const d of enumerateDatesInclusive(rangeStart, rangeEnd)) {
    const s = shiftByDay.get(d) ?? 0
    const v = vacationByDay.get(d) ?? 0
    if (v > 0) rawPaidVacation += v
    else rawPlannedShift += s
  }

  const plannedShiftHours = Math.round(rawPlannedShift * 10) / 10
  const paidVacationHours = Math.round(rawPaidVacation * 10) / 10
  const totalHours = Math.round((rawPlannedShift + rawPaidVacation) * 10) / 10

  return {
    employeeId,
    employeeName: employeeId,
    rangeStart,
    rangeEnd,
    plannedShiftHours,
    paidVacationHours,
    totalHours,
  }
}

export type MonthHourLimitViolation = {
  employeeId: string
  displayName: string
  plannedHours: number
  maxHours: number
}

export function listMonthHourLimitViolations(
  db: Database,
  stationId: string,
  containedYmd: string,
  federalState: GermanState,
): MonthHourLimitViolation[] {
  const { from, to } = calendarMonthRangeFromYmd(containedYmd)
  const employees = db
    .prepare(
      `SELECT id, display_name, employment_type, max_hours_per_month
       FROM employees
       WHERE station_id = ?
         AND (deleted_at IS NULL OR trim(deleted_at) = '')
         AND COALESCE(active, 1) = 1
         AND lower(trim(COALESCE(status, ''))) NOT IN ('deleted', 'geloescht', 'inactive', 'inaktiv', 'blocked', 'gesperrt')
         AND max_hours_per_month IS NOT NULL AND max_hours_per_month > 0`,
    )
    .all(stationId) as {
    id: string
    display_name: string
    employment_type: string
    max_hours_per_month: number
  }[]

  if (!employees.length) return []

  const shiftRows = listShiftRowsForStationDateRange(db, stationId, from, to)
  const absenceRows = db
    .prepare(
      `SELECT * FROM absences WHERE station_id = ? AND end_date >= ? AND start_date <= ? AND status = 'approved'`,
    )
    .all(stationId, from, to) as AbsenceRow[]

  const out: MonthHourLimitViolation[] = []
  for (const emp of employees) {
    const maxH = Number(emp.max_hours_per_month)
    if (!Number.isFinite(maxH) || maxH <= 0) continue
    const breakdown = calculateEmployeePlannedHoursFromRows(
      emp.id,
      shiftRows,
      absenceRows,
      emp.employment_type ?? 'teilzeit',
      federalState,
      from,
      to,
    )
    if (breakdown.totalHours > maxH + 1e-6) {
      out.push({
        employeeId: emp.id,
        displayName: emp.display_name,
        plannedHours: breakdown.totalHours,
        maxHours: maxH,
      })
    }
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'))
  return out
}

export type ProposedMonthShift = {
  employeeId: string
  date: string
  start: string
  end: string
  existingShiftId?: string
}

function rangesOverlapDay(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = timeToMinutes(aStart)
  let ae = timeToMinutes(aEnd)
  if (ae <= as) ae += 24 * 60
  const bs = timeToMinutes(bStart)
  let be = timeToMinutes(bEnd)
  if (be <= bs) be += 24 * 60
  return as < be && ae > bs
}

/** Wendet Assistenten-Vorschläge auf Monats-Schichten an (nur für Stundenprojektion). */
export function applyProposedToMonthShiftRows(monthRows: ShiftRow[], proposed: ProposedMonthShift[]): ShiftRow[] {
  const rows = monthRows.map((r) => ({ ...r }))
  const byId = new Map(rows.map((r) => [r.id, r]))

  for (const p of proposed) {
    if (p.existingShiftId && byId.has(p.existingShiftId)) {
      byId.get(p.existingShiftId)!.employee_id = p.employeeId
      continue
    }
    const open = rows.find(
      (r) =>
        r.date === p.date &&
        !r.employee_id &&
        String(r.shift_type ?? '').trim() !== 'frei' &&
        rangesOverlapDay(r.start_time, r.end_time, p.start, p.end),
    )
    if (open) {
      open.employee_id = p.employeeId
      continue
    }
    const fallbackStationId = monthRows[0]?.station_id ?? ''
    const fallbackWorkAreaId = monthRows[0]?.work_area_id ?? ''
    rows.push({
      id: `proj-${p.employeeId}-${p.date}-${p.start}`,
      station_id: fallbackStationId,
      employee_id: p.employeeId,
      work_area_id: fallbackWorkAreaId,
      date: p.date,
      start_time: p.start,
      end_time: p.end,
      break_minutes: 0,
      shift_type: 'frueh',
      title: null,
      note: null,
      color: null,
      status: 'draft',
      published: 0,
      conflict: 0,
    })
  }
  return rows
}

export function wouldExceedMaxHoursPerMonth(
  employeeId: string,
  employmentType: string,
  maxHoursPerMonth: number | null | undefined,
  monthRows: ShiftRow[],
  absenceRows: AbsenceRow[],
  proposed: ProposedMonthShift[],
  federalState: GermanState,
  monthFrom: string,
  monthTo: string,
): boolean {
  const cap = maxHoursPerMonth != null ? Number(maxHoursPerMonth) : NaN
  if (!Number.isFinite(cap) || cap <= 0) return false
  const projected = applyProposedToMonthShiftRows(monthRows, proposed)
  const breakdown = calculateEmployeePlannedHoursFromRows(
    employeeId,
    projected,
    absenceRows,
    employmentType,
    federalState,
    monthFrom,
    monthTo,
  )
  return breakdown.totalHours > cap + 1e-6
}
