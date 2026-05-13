import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'
import { workDayCodesFromEmployeeRow, type AbsenceCountMode } from '../utils/absenceYearCalculator.js'
import {
  calculateVacationImpact,
  normalizeAbsenceDbType,
} from '../utils/vacationImpactCalculator.js'
import { calculateVacationDaysForRequest, isStableEmploymentForHolidayExclusion } from '../utils/vacationRequestCalculator.js'
import {
  calendarYearFromStartDate,
  paidVacationDeductibleInCalendarYear,
  sumApprovedPaidVacationDaysInYear,
  sumPendingPaidVacationDaysInYear,
  type PaidVacationBalanceCtx,
  type AbsenceBalanceRow,
} from '../utils/vacationBalanceCalculator.js'

const STATUS_TO_DE: Record<string, string> = {
  requested: 'beantragt',
  approved: 'genehmigt',
  rejected: 'abgelehnt',
  cancelled: 'storniert',
  recorded: 'erfasst',
}

const DE_TO_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_TO_DE).map(([k, v]) => [v, k]),
)

function statusToApi(statusDb: string): string {
  return STATUS_TO_DE[statusDb] ?? statusDb
}

function statusFromApi(statusDe: string): string {
  return DE_TO_STATUS[statusDe] ?? statusDe
}

export class VacationAckRequiredError extends Error {
  readonly code = 'VACATION_ACK_REQUIRED' as const
  constructor(public readonly details: Record<string, unknown>) {
    super('VACATION_ACK_REQUIRED')
    this.name = 'VacationAckRequiredError'
  }
}

type EmpVac = {
  annual_vacation_days: number | null
  vacation_hours_per_day: number | null
  work_days_json: string | null
}

function loadEmployeeVacationSlice(db: Database, employeeId: string): EmpVac | undefined {
  return db
    .prepare(
      `SELECT annual_vacation_days, vacation_hours_per_day, work_days_json FROM employees WHERE id = ?`,
    )
    .get(employeeId) as EmpVac | undefined
}

function loadEmployeePolicySlice(
  db: Database,
  employeeId: string,
):
  | {
      employment_type: string | null
      employment_role: string | null
      vacation_hours_per_day: number | null
      work_days_json: string | null
    }
  | undefined {
  return db
    .prepare(
      `SELECT employment_type, employment_role, vacation_hours_per_day, work_days_json FROM employees WHERE id = ?`,
    )
    .get(employeeId) as
    | {
        employment_type: string | null
        employment_role: string | null
        vacation_hours_per_day: number | null
        work_days_json: string | null
      }
    | undefined
}

function loadStationFederalState(db: Database, stationId: string): string {
  const r = db.prepare(`SELECT federal_state FROM stations WHERE id = ?`).get(stationId) as
    | { federal_state: string | null }
    | undefined
  return String(r?.federal_state ?? 'BW')
    .trim()
    .toUpperCase()
    .slice(0, 2) || 'BW'
}

function computePaidVacationImpactFromPolicy(
  db: Database,
  stationId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
  halfDay: boolean,
): ReturnType<typeof calculateVacationImpact> {
  const emp = loadEmployeePolicySlice(db, employeeId)
  const fed = loadStationFederalState(db, stationId)
  const calc = calculateVacationDaysForRequest({
    employmentType: String(emp?.employment_type ?? ''),
    employmentRole: String(emp?.employment_role ?? ''),
    federalState: fed,
    vacationHoursPerDay: emp?.vacation_hours_per_day,
    startDate,
    endDate,
    halfDay,
    absenceTypeRaw: 'paid_vacation',
  })
  const round2 = (x: number) => Math.round(x * 100) / 100
  return {
    absenceDays: round2(calc.vacationDaysToDeduct),
    paidHoursPerDay: calc.paidHoursPerDay,
    paidHoursTotal: round2(calc.paidHours),
    countsAgainstVacation: true,
    paid: true,
    affectsRemainingVacation: true,
  }
}

export function loadAbsenceBalanceRows(
  db: Database,
  stationId: string,
  employeeId: string,
  year: number,
): AbsenceBalanceRow[] {
  const yStart = `${year}-01-01`
  const yEnd = `${year}-12-31`
  return db
    .prepare(
      `SELECT id, employee_id, type, start_date, end_date, half_day, status,
              counts_against_vacation
       FROM absences
       WHERE station_id = ? AND employee_id = ? AND end_date >= ? AND start_date <= ?`,
    )
    .all(stationId, employeeId, yStart, yEnd) as AbsenceBalanceRow[]
}

const VACATION_BALANCE_MODE: AbsenceCountMode = 'calendar_days'

export type AbsenceRow = {
  id: string
  station_id: string
  employee_id: string
  type: string
  start_date: string
  end_date: string
  half_day: number | null
  status: string
  comment: string | null
  requested_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejected_reason: string | null
  paid: number | null
  counts_against_vacation: number | null
  paid_hours_per_day: number | null
  paid_hours_total: number | null
  absence_days: number | null
  certificate_source?: string | null
}

export function rowToAbsenceApi(r: AbsenceRow) {
  const t = normalizeAbsenceDbType(r.type)
  return {
    id: r.id,
    employeeId: r.employee_id,
    type: t,
    startDate: r.start_date,
    endDate: r.end_date,
    halfDay: (r.half_day ?? 0) === 1,
    status: statusToApi(r.status) as string,
    comment: r.comment ?? '',
    requestedAt: r.requested_at ?? nowIso(),
    approvedBy: r.approved_by ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    rejectedReason: r.rejected_reason ?? undefined,
    rejectedBy: r.rejected_by ?? undefined,
    rejectedAt: r.rejected_at ?? undefined,
    paid: (r.paid ?? 0) === 1,
    countsAgainstVacation: (r.counts_against_vacation ?? 0) === 1,
    paidHoursPerDay: Number(r.paid_hours_per_day ?? 0),
    paidHoursTotal: Number(r.paid_hours_total ?? 0),
    absenceDays: Number(r.absence_days ?? 0),
    certificateSource: r.certificate_source ? String(r.certificate_source) : undefined,
  }
}

function readPaidHoursFromBody(body: Record<string, unknown>): number | undefined {
  if (body.paidHoursPerDay != null && body.paidHoursPerDay !== '') {
    const n = Number(body.paidHoursPerDay)
    return Number.isFinite(n) ? n : undefined
  }
  if (body.paid_hours_per_day != null && body.paid_hours_per_day !== '') {
    const n = Number(body.paid_hours_per_day)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function computeImpactForRow(
  db: Database,
  employeeId: string,
  typeRaw: string,
  startDate: string,
  endDate: string,
  halfDay: boolean,
  paidHoursOverride?: number | null,
) {
  const typeDb = normalizeAbsenceDbType(typeRaw)
  const emp = loadEmployeeVacationSlice(db, employeeId)
  return calculateVacationImpact(
    {
      type: typeDb,
      startDate,
      endDate,
      halfDay,
      paidHoursPerDay: paidHoursOverride,
    },
    { vacation_hours_per_day: emp?.vacation_hours_per_day },
  )
}

export function listAbsences(
  db: Database,
  q: {
    stationId?: string
    from?: string
    to?: string
    employeeId?: string
    status?: string
    type?: string
  },
) {
  const stationId = q.stationId ?? DEFAULT_STATION_ID
  let sql = `SELECT * FROM absences WHERE station_id = ?`
  const params: string[] = [stationId]
  if (q.from) {
    sql += ` AND end_date >= ?`
    params.push(q.from)
  }
  if (q.to) {
    sql += ` AND start_date <= ?`
    params.push(q.to)
  }
  if (q.employeeId) {
    sql += ` AND employee_id = ?`
    params.push(q.employeeId)
  }
  if (q.status) {
    const st = statusFromApi(q.status) ?? q.status
    sql += ` AND status = ?`
    params.push(st)
  }
  if (q.type) {
    const qt = normalizeAbsenceDbType(String(q.type))
    sql += ` AND type = ?`
    params.push(qt)
  }
  sql += ` ORDER BY start_date`
  const rows = db.prepare(sql).all(...params) as AbsenceRow[]
  return rows.map(rowToAbsenceApi)
}

export function countRequestedAbsences(db: Database, stationId = DEFAULT_STATION_ID): number {
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM absences WHERE station_id = ? AND status = 'requested'`)
    .get(stationId) as { c: number }
  return row?.c ?? 0
}

function formatDeYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`
}

const ABS_TYPE_SNIPPET_DE: Record<string, string> = {
  paid_vacation: 'Bezahlter Urlaub',
  vacation: 'Bezahlter Urlaub',
  unpaid_vacation: 'Unbezahlter Urlaub',
  unpaid: 'Unbezahlter Urlaub',
  day_off: 'Frei',
  sick: 'Krank',
  special_leave: 'Sonderurlaub',
  child_sick: 'Kind krank',
  other: 'Sonstiges',
  school: 'Berufsschule',
}

/** Letzte offene Antrags-Zeile für Benachrichtigungstext (Name + Zeitraum). */
export function getLatestRequestedAbsenceSnippet(db: Database, stationId: string): string | null {
  const r = db
    .prepare(
      `SELECT e.display_name as dn, a.type as ty, a.start_date as sd, a.end_date as ed
       FROM absences a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.station_id = ? AND a.status = 'requested'
       ORDER BY datetime(COALESCE(a.requested_at, a.created_at, a.updated_at)) DESC
       LIMIT 1`,
    )
    .get(stationId) as { dn: string; ty: string; sd: string; ed: string } | undefined
  if (!r) return null
  const t = ABS_TYPE_SNIPPET_DE[r.ty] ?? ABS_TYPE_SNIPPET_DE[normalizeAbsenceDbType(r.ty)] ?? 'Abwesenheit'
  return `${r.dn} beantragt ${t} vom ${formatDeYmd(r.sd)} bis ${formatDeYmd(r.ed)}.`
}

export function getAbsence(db: Database, id: string) {
  const r = db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined
  return r ? rowToAbsenceApi(r) : undefined
}

export function getAbsenceRow(db: Database, id: string): AbsenceRow | undefined {
  return db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined
}

/** Jahres-Resturlaub-Übersicht für Mitarbeiter-App (Kalendertage, bezahlter Urlaub). */
export function buildVacationSnapshotForEmployee(
  db: Database,
  stationId: string,
  employeeId: string,
  year: number,
) {
  const emp = loadEmployeeVacationSlice(db, employeeId)
  const empPol = loadEmployeePolicySlice(db, employeeId)
  const workCodes = workDayCodesFromEmployeeRow(emp?.work_days_json)
  const rows = loadAbsenceBalanceRows(db, stationId, employeeId, year)
  const annualDays = Number(emp?.annual_vacation_days ?? 0) || 0
  const fed = loadStationFederalState(db, stationId)
  const paidCtx: PaidVacationBalanceCtx = {
    employmentType: String(empPol?.employment_type ?? ''),
    employmentRole: String(empPol?.employment_role ?? ''),
    federalState: fed,
    vacationHoursPerDay: empPol?.vacation_hours_per_day,
  }
  const approvedPaid = sumApprovedPaidVacationDaysInYear(
    rows,
    employeeId,
    year,
    VACATION_BALANCE_MODE,
    workCodes,
    undefined,
    paidCtx,
  )
  const pendingPaid = sumPendingPaidVacationDaysInYear(
    rows,
    employeeId,
    year,
    VACATION_BALANCE_MODE,
    workCodes,
    undefined,
    paidCtx,
  )
  const remainingPaid = Math.round((annualDays - approvedPaid - pendingPaid) * 100) / 100
  return {
    year,
    annualVacationDays: annualDays,
    approvedPaidVacationDays: approvedPaid,
    pendingPaidVacationDays: pendingPaid,
    remainingPaidVacationDays: remainingPaid,
  }
}

/** Prüfung Resturlaub für neuen bezahlten Urlaubsantrag (Mitarbeiter-App). */
export function evaluatePaidVacationRequestDebt(
  db: Database,
  stationId: string,
  employeeId: string,
  p: {
    startDate: string
    endDate: string
    halfDay: boolean
    typeInput: string
  },
) {
  const typeDb = normalizeAbsenceDbType(p.typeInput)
  if (typeDb !== 'paid_vacation') {
    return { exceeds: false as const, previewWarnings: [] as string[] }
  }
  const year = calendarYearFromStartDate(p.startDate)
  const emp = loadEmployeeVacationSlice(db, employeeId)
  const empPol = loadEmployeePolicySlice(db, employeeId)
  const workCodes = workDayCodesFromEmployeeRow(emp?.work_days_json)
  const annual = Number(emp?.annual_vacation_days ?? 0) || 0
  const rows = loadAbsenceBalanceRows(db, stationId, employeeId, year)
  const fed = loadStationFederalState(db, stationId)
  const paidCtx: PaidVacationBalanceCtx = {
    employmentType: String(empPol?.employment_type ?? ''),
    employmentRole: String(empPol?.employment_role ?? ''),
    federalState: fed,
    vacationHoursPerDay: empPol?.vacation_hours_per_day,
  }
  const taken = sumApprovedPaidVacationDaysInYear(rows, employeeId, year, VACATION_BALANCE_MODE, workCodes, undefined, paidCtx)
  const pending = sumPendingPaidVacationDaysInYear(rows, employeeId, year, VACATION_BALANCE_MODE, workCodes, undefined, paidCtx)
  const calc = calculateVacationDaysForRequest({
    employmentType: String(empPol?.employment_type ?? ''),
    employmentRole: String(empPol?.employment_role ?? ''),
    federalState: fed,
    vacationHoursPerDay: empPol?.vacation_hours_per_day,
    startDate: p.startDate,
    endDate: p.endDate,
    halfDay: p.halfDay,
    absenceTypeRaw: 'paid_vacation',
  })
  const requestDays = calc.vacationDaysToDeduct
  const remaining = Math.round((annual - taken - pending) * 100) / 100
  const afterRequest = Math.round((remaining - requestDays) * 100) / 100
  const exceeds = requestDays > remaining
  return {
    exceeds,
    annualVacationDays: annual,
    approvedPaidVacationDays: taken,
    pendingPaidVacationDays: pending,
    remainingVacationDays: remaining,
    requestedPaidVacationDays: requestDays,
    remainingAfterRequest: afterRequest,
    year,
    previewWarnings: calc.warnings,
  }
}

export function assertPaidVacationCreateAllowed(
  db: Database,
  stationId: string,
  employeeId: string,
  body: Record<string, unknown>,
  p: { startDate: string; endDate: string; halfDay: boolean; typeInput: string },
) {
  const ack =
    body.acknowledgeVacationDebt === true ||
    Number(body.acknowledgeVacationDebt) === 1 ||
    String(body.acknowledgeVacationDebt ?? '').toLowerCase() === 'true'
  const ev = evaluatePaidVacationRequestDebt(db, stationId, employeeId, { ...p, typeInput: p.typeInput })
  if (!ev.exceeds) return
  if (ack) return
  throw new VacationAckRequiredError({
    message:
      'Der Antrag würde dein Urlaubskonto ins Minus bringen. Der fehlende Urlaub kann ggf. vom Folgejahr abgezogen werden. Bitte bestätige den Antrag trotzdem oder brich ab.',
    ...ev,
  })
}

export function createAbsence(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const employeeId = String(body.employeeId ?? '').trim()
  const typeInput = String(body.type ?? '').trim()
  const startDate = String(body.startDate ?? '').trim()
  const endDate = String(body.endDate ?? '').trim()
  if (!employeeId) throw new Error('employee_id erforderlich')
  if (!typeInput) throw new Error('type erforderlich')
  if (!startDate) throw new Error('start_date erforderlich')
  if (!endDate) throw new Error('end_date erforderlich')
  const halfDay = body.halfDay === true
  const typeDb = normalizeAbsenceDbType(typeInput)
  const impact =
    typeDb === 'paid_vacation'
      ? computePaidVacationImpactFromPolicy(db, stationId, employeeId, startDate, endDate, halfDay)
      : computeImpactForRow(db, employeeId, typeInput, startDate, endDate, halfDay, undefined)
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `abs-${randomUUID()}`
  const ts = nowIso()
  const status = statusFromApi(String(body.status ?? 'beantragt')) ?? 'requested'
  const certificateSource =
    body.certificateSource != null && String(body.certificateSource).trim()
      ? String(body.certificateSource).trim().slice(0, 80)
      : null
  db.prepare(
    `INSERT INTO absences (
       id, station_id, employee_id, type, start_date, end_date, half_day, status, comment,
       requested_at, approved_by, approved_at, rejected_by, rejected_at, rejected_reason,
       paid, counts_against_vacation, paid_hours_per_day, paid_hours_total, absence_days,
       certificate_source,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?,
       ?,
       ?, ?)`,
  ).run(
    id,
    stationId,
    employeeId,
    typeDb,
    startDate,
    endDate,
    halfDay ? 1 : 0,
    status,
    String(body.comment ?? ''),
    ts,
    impact.paid ? 1 : 0,
    impact.countsAgainstVacation ? 1 : 0,
    impact.paidHoursPerDay,
    impact.paidHoursTotal,
    impact.absenceDays,
    certificateSource,
    ts,
    ts,
  )
  return getAbsence(db, id)
}

export function updateAbsence(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined
  if (!existing) throw new Error('Abwesenheit nicht gefunden')
  const ts = nowIso()
  const employeeId =
    body.employeeId != null ? String(body.employeeId) : existing.employee_id
  const startDate = body.startDate != null ? String(body.startDate) : existing.start_date
  const endDate = body.endDate != null ? String(body.endDate) : existing.end_date
  const halfDay =
    body.halfDay != null ? body.halfDay === true : (existing.half_day ?? 0) === 1
  const typeInput = body.type != null ? String(body.type) : existing.type
  const paidHoursOverride =
    body.paidHoursPerDay != null || body.paid_hours_per_day != null
      ? readPaidHoursFromBody(body as Record<string, unknown>)
      : existing.paid_hours_per_day
  const impact = computeImpactForRow(db, employeeId, typeInput, startDate, endDate, halfDay, paidHoursOverride)
  const typeDb = normalizeAbsenceDbType(typeInput)
  const status =
    body.status != null ? statusFromApi(String(body.status)) ?? String(body.status) : existing.status
  db.prepare(
    `UPDATE absences SET
      employee_id = ?,
      type = ?,
      start_date = ?,
      end_date = ?,
      half_day = ?,
      status = ?,
      comment = COALESCE(?, comment),
      paid = ?,
      counts_against_vacation = ?,
      paid_hours_per_day = ?,
      paid_hours_total = ?,
      absence_days = ?,
      updated_at = ?
    WHERE id = ?`,
  ).run(
    employeeId,
    typeDb,
    startDate,
    endDate,
    halfDay ? 1 : 0,
    status,
    body.comment != null ? String(body.comment) : null,
    impact.paid ? 1 : 0,
    impact.countsAgainstVacation ? 1 : 0,
    impact.paidHoursPerDay,
    impact.paidHoursTotal,
    impact.absenceDays,
    ts,
    id,
  )
  return getAbsence(db, id)
}

export function deleteAbsence(db: Database, id: string) {
  const r = db.prepare(`DELETE FROM absences WHERE id = ?`).run(id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
}

export function approveAbsence(
  db: Database,
  id: string,
  by = 'Station',
  options?: { acknowledgeVacationDebt?: boolean },
) {
  const row = db.prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as AbsenceRow | undefined
  if (!row) throw new Error('Abwesenheit nicht gefunden')
  if (row.status !== 'requested') throw new Error('Nur beantragte Abwesenheiten können genehmigt werden')

  const typeDb = normalizeAbsenceDbType(row.type)
  const counts = row.counts_against_vacation
  const affects =
    typeDb === 'paid_vacation' && (counts === null || counts === undefined || counts === 1)

  if (affects) {
    const year = calendarYearFromStartDate(row.start_date)
    const emp = loadEmployeeVacationSlice(db, row.employee_id)
    const empPol = loadEmployeePolicySlice(db, row.employee_id)
    const workCodes = workDayCodesFromEmployeeRow(emp?.work_days_json)
    const annual = Number(emp?.annual_vacation_days ?? 0) || 0
    const balRows = loadAbsenceBalanceRows(db, row.station_id, row.employee_id, year)
    const fed = loadStationFederalState(db, row.station_id)
    const paidCtx: PaidVacationBalanceCtx = {
      employmentType: String(empPol?.employment_type ?? ''),
      employmentRole: String(empPol?.employment_role ?? ''),
      federalState: fed,
      vacationHoursPerDay: empPol?.vacation_hours_per_day,
    }
    const taken = sumApprovedPaidVacationDaysInYear(
      balRows,
      row.employee_id,
      year,
      VACATION_BALANCE_MODE,
      workCodes,
      id,
      paidCtx,
    )
    const currentInYear = paidVacationDeductibleInCalendarYear(
      {
        id: row.id,
        employee_id: row.employee_id,
        type: row.type,
        start_date: row.start_date,
        end_date: row.end_date,
        half_day: row.half_day,
        status: row.status,
        counts_against_vacation: row.counts_against_vacation,
      },
      year,
      VACATION_BALANCE_MODE,
      workCodes,
      paidCtx,
    )
    const remainingAfter = Math.round((annual - taken - currentInYear) * 100) / 100
    const ack =
      options?.acknowledgeVacationDebt === true ||
      String(options?.acknowledgeVacationDebt ?? '').toLowerCase() === 'true' ||
      String(options?.acknowledgeVacationDebt ?? '') === '1'
    if (remainingAfter < 0 && !ack) {
      throw new VacationAckRequiredError({
        message: 'Dieser Mitarbeiter hat nicht genügend Resturlaub.',
        annualVacationDays: annual,
        alreadyTakenDays: taken,
        requestedDays: currentInYear,
        remainingAfterApproval: remainingAfter,
        hint: 'Minus-Urlaub wird gespeichert und kann im Folgejahr berücksichtigt werden.',
      })
    }
  }

  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE absences SET status = 'approved', approved_by = ?, approved_at = ?, rejected_reason = NULL, rejected_by = NULL, rejected_at = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(by, ts, ts, id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
  return getAbsence(db, id)
}

export function rejectAbsence(db: Database, id: string, reason: string | undefined, rejectedByUserId?: string) {
  const trimmed = String(reason ?? '').trim()
  if (!trimmed) throw new Error('Ablehnungsgrund erforderlich')
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE absences SET status = 'rejected', rejected_reason = ?, rejected_by = ?, rejected_at = ?, approved_by = NULL, approved_at = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(trimmed, rejectedByUserId ?? null, ts, ts, id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
  return getAbsence(db, id)
}

export function cancelAbsence(db: Database, id: string) {
  const existing = db.prepare(`SELECT status FROM absences WHERE id = ?`).get(id) as { status: string } | undefined
  if (!existing) throw new Error('Abwesenheit nicht gefunden')
  if (existing.status !== 'requested') throw new Error('Nur beantragte Abwesenheiten können storniert werden')
  const ts = nowIso()
  const r = db
    .prepare(`UPDATE absences SET status = 'cancelled', updated_at = ? WHERE id = ?`)
    .run(ts, id)
  if (r.changes === 0) throw new Error('Abwesenheit nicht gefunden')
  return getAbsence(db, id)
}

/** Mitarbeiter-App: Urlaubskonto + optionale Live-Vorschau (Query-Parameter). */
export function buildEmployeeAppVacationBalance(
  db: Database,
  stationId: string,
  employeeId: string,
  q: {
    previewStart?: string
    previewEnd?: string
    previewHalfDay?: string | boolean
    previewType?: string
  },
) {
  const y = q.previewStart && /^\d{4}-\d{2}-\d{2}$/.test(q.previewStart)
    ? calendarYearFromStartDate(q.previewStart)
    : new Date().getFullYear()
  const snap = buildVacationSnapshotForEmployee(db, stationId, employeeId, y)
  const empPol = loadEmployeePolicySlice(db, employeeId)
  const fed = loadStationFederalState(db, stationId)
  const appliesHolidayExclusion = isStableEmploymentForHolidayExclusion(
    String(empPol?.employment_type ?? ''),
    String(empPol?.employment_role ?? ''),
  )
  const out: Record<string, unknown> = {
    ...snap,
    appliesHolidayExclusion,
  }
  const ps = q.previewStart && /^\d{4}-\d{2}-\d{2}$/.test(String(q.previewStart)) ? String(q.previewStart) : ''
  const pe = q.previewEnd && /^\d{4}-\d{2}-\d{2}$/.test(String(q.previewEnd)) ? String(q.previewEnd) : ''
  if (ps && pe && ps <= pe) {
    const half = q.previewHalfDay === true || String(q.previewHalfDay ?? '').toLowerCase() === 'true'
    const calc = calculateVacationDaysForRequest({
      employmentType: String(empPol?.employment_type ?? ''),
      employmentRole: String(empPol?.employment_role ?? ''),
      federalState: fed,
      vacationHoursPerDay: empPol?.vacation_hours_per_day,
      startDate: ps,
      endDate: pe,
      halfDay: half,
      absenceTypeRaw: q.previewType || 'paid_vacation',
    })
    const typeDb = normalizeAbsenceDbType(q.previewType || 'paid_vacation')
    const debt =
      typeDb === 'paid_vacation'
        ? evaluatePaidVacationRequestDebt(db, stationId, employeeId, {
            startDate: ps,
            endDate: pe,
            halfDay: half,
            typeInput: 'paid_vacation',
          })
        : null
    out.preview = {
      ...calc,
      exceedsVacation: debt?.exceeds ?? false,
      remainingAfterRequest: debt?.remainingAfterRequest,
      remainingVacationDays: debt?.remainingVacationDays,
    }
  }
  return out
}
