import type { Database } from 'better-sqlite3'
import { randomBytes, randomUUID } from 'node:crypto'
import { DEFAULT_STATION_ID } from '../constants.js'
import { nowIso } from '../utils/timestamps.js'

export type EmployeeRow = {
  id: string
  station_id: string
  first_name: string
  last_name: string
  display_name: string
  email: string | null
  phone: string | null
  birthday: string | null
  role: string | null
  employment_type: string | null
  hourly_wage: number | null
  monthly_salary: number | null
  weekly_hours: number | null
  monthly_hours: number | null
  vacation_days_total: number | null
  vacation_days_used: number | null
  color: string | null
  status: string | null
  cash_register_card_number: string | null
  terminal_enabled: number | null
  time_tracking_enabled: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  active: number | null
  employee_access_token?: string | null
  employee_access_enabled?: number | null
  employee_access_created_at?: string | null
  employee_access_last_used_at?: string | null
}

function mapStatusToFrontend(dbStatus: string | null, active: number | null): string {
  if (active === 0) return 'inaktiv'
  if (dbStatus === 'inactive') return 'inaktiv'
  if (dbStatus === 'urlaub' || dbStatus === 'krank') return dbStatus
  return 'aktiv'
}

export function rowToEmployeeApi(
  row: EmployeeRow,
  workAreaIds: string[],
  options?: { includeAccessToken?: boolean },
) {
  const total = row.vacation_days_total ?? 0
  const used = row.vacation_days_used ?? 0
  const token = row.employee_access_token?.trim() ?? ''
  const configured = Boolean(token)
  const enabled = (row.employee_access_enabled ?? 1) === 1
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    birthday: row.birthday ?? '',
    role: row.role ?? '',
    employmentType: (row.employment_type ?? 'teilzeit') as string,
    hourlyWage: row.hourly_wage ?? 0,
    monthlySalary: row.monthly_salary ?? undefined,
    weeklyHours: row.weekly_hours ?? 0,
    monthlyHours: row.monthly_hours ?? 0,
    vacationDaysTotal: total,
    vacationDaysUsed: used,
    remainingVacationDays: Math.max(0, total - used),
    color: row.color ?? '#94a3b8',
    status: mapStatusToFrontend(row.status, row.active),
    workAreaIds,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? undefined,
    notes: row.notes ?? '',
    cashRegisterCardNumber: row.cash_register_card_number ?? '',
    terminalEnabled: (row.terminal_enabled ?? 1) === 1,
    timeTrackingEnabled: (row.time_tracking_enabled ?? 1) === 1,
    employeeAccessConfigured: configured,
    employeeAccessEnabled: enabled && configured,
    employeeAccessCreatedAt: row.employee_access_created_at ?? undefined,
    employeeAccessLastUsedAt: row.employee_access_last_used_at ?? undefined,
    ...(options?.includeAccessToken ? { employeeAccessToken: token } : {}),
  }
}

export function listEmployees(
  db: Database,
  stationId = DEFAULT_STATION_ID,
  opts?: { includeInactive?: boolean },
) {
  const sql =
    opts?.includeInactive === true
      ? `SELECT * FROM employees WHERE station_id = ? ORDER BY display_name`
      : `SELECT * FROM employees WHERE station_id = ? AND (active IS NULL OR active = 1) ORDER BY display_name`
  const rows = db.prepare(sql).all(stationId) as EmployeeRow[]
  const wa = db.prepare(`SELECT work_area_id FROM employee_work_areas WHERE employee_id = ?`)
  return rows.map((r) =>
    rowToEmployeeApi(
      r,
      (wa.all(r.id) as { work_area_id: string }[]).map((x) => x.work_area_id),
      { includeAccessToken: true },
    ),
  )
}

export function getEmployee(db: Database, id: string, includeAccessToken = true) {
  const row = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as EmployeeRow | undefined
  if (!row) return undefined
  const wa = db
    .prepare(`SELECT work_area_id FROM employee_work_areas WHERE employee_id = ?`)
    .all(id)
    .map((x) => (x as { work_area_id: string }).work_area_id)
  return rowToEmployeeApi(row, wa, { includeAccessToken })
}

export function getEmployeeByCard(db: Database, cardNumber: string, stationId = DEFAULT_STATION_ID) {
  const row = db
    .prepare(
      `SELECT * FROM employees WHERE station_id = ? AND cash_register_card_number = ? AND (active IS NULL OR active = 1)`,
    )
    .get(stationId, cardNumber.trim()) as EmployeeRow | undefined
  if (!row) return undefined
  return getEmployee(db, row.id, false)
}

export function createEmployee(db: Database, body: Record<string, unknown>, stationId = DEFAULT_STATION_ID) {
  const displayName = String(body.displayName ?? '').trim()
  if (!displayName) throw new Error('display_name erforderlich')
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID()
  const ts = nowIso()
  const workAreaIds = Array.isArray(body.workAreaIds) ? (body.workAreaIds as string[]) : ['kasse']

  const accessTok = randomBytes(32).toString('hex')

  db.prepare(
    `INSERT INTO employees (
      id, station_id, first_name, last_name, display_name, email, phone, birthday, role, employment_type,
      hourly_wage, monthly_salary, weekly_hours, monthly_hours, vacation_days_total, vacation_days_used,
      color, status, cash_register_card_number, terminal_enabled, time_tracking_enabled,
      start_date, end_date, notes, active,
      employee_access_token, employee_access_enabled, employee_access_created_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL, 1,
      ?, 1, ?,
      ?, ?)`,
  ).run(
    id,
    stationId,
    String(body.firstName ?? '').trim() || (displayName.split(/\s+/)[0] ?? ''),
    String(body.lastName ?? '').trim() || (displayName.split(/\s+/).slice(1).join(' ') || ''),
    displayName,
    String(body.email ?? '') || null,
    String(body.phone ?? '') || null,
    String(body.birthday ?? '') || null,
    String(body.role ?? 'Verkäufer') || null,
    String(body.employmentType ?? 'teilzeit') || null,
    Number(body.hourlyWage ?? 14),
    body.monthlySalary != null ? Number(body.monthlySalary) : null,
    Number(body.weeklyHours ?? 40),
    Number(body.monthlyHours ?? 0),
    Number(body.vacationDaysTotal ?? 28),
    Number(body.vacationDaysUsed ?? 0),
    String(body.color ?? '#22d3ee'),
    String(body.cashRegisterCardNumber ?? '').trim() || null,
    body.terminalEnabled === false ? 0 : 1,
    body.timeTrackingEnabled === false ? 0 : 1,
    String(body.startDate ?? ts.slice(0, 10)),
    String(body.notes ?? ''),
    accessTok,
    ts,
    ts,
    ts,
  )

  const insWa = db.prepare(`INSERT INTO employee_work_areas (id, employee_id, work_area_id) VALUES (?, ?, ?)`)
  for (const wid of workAreaIds) {
    insWa.run(randomUUID(), id, wid)
  }

  return getEmployee(db, id)
}

export function updateEmployee(db: Database, id: string, body: Record<string, unknown>) {
  const existing = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as EmployeeRow | undefined
  if (!existing) throw new Error('Mitarbeiter nicht gefunden')

  const ts = nowIso()
  if (body.status === 'inaktiv' || body.status === 'inactive') {
    db.prepare(
      `UPDATE employees SET active = 0, status = 'inactive', employee_access_enabled = 0, updated_at = ? WHERE id = ?`,
    ).run(ts, id)
  } else if (body.status === 'aktiv' || body.status === 'active') {
    db.prepare(
      `UPDATE employees SET active = 1, status = 'active', employee_access_enabled = 1, updated_at = ? WHERE id = ?`,
    ).run(ts, id)
  }
  db.prepare(
    `UPDATE employees SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      display_name = COALESCE(?, display_name),
      email = ?, phone = ?, birthday = ?, role = ?, employment_type = ?,
      hourly_wage = ?, monthly_salary = ?, weekly_hours = ?, monthly_hours = ?,
      vacation_days_total = ?, vacation_days_used = ?, color = ?,
      cash_register_card_number = ?, terminal_enabled = ?, time_tracking_enabled = ?,
      start_date = ?, end_date = ?, notes = ?, updated_at = ?
    WHERE id = ?`,
  ).run(
    body.firstName != null ? String(body.firstName) : null,
    body.lastName != null ? String(body.lastName) : null,
    body.displayName != null ? String(body.displayName) : null,
    body.email != null ? String(body.email) : existing.email,
    body.phone != null ? String(body.phone) : existing.phone,
    body.birthday != null ? String(body.birthday) : existing.birthday,
    body.role != null ? String(body.role) : existing.role,
    body.employmentType != null ? String(body.employmentType) : existing.employment_type,
    body.hourlyWage != null ? Number(body.hourlyWage) : existing.hourly_wage,
    body.monthlySalary !== undefined ? (body.monthlySalary == null ? null : Number(body.monthlySalary)) : existing.monthly_salary,
    body.weeklyHours != null ? Number(body.weeklyHours) : existing.weekly_hours,
    body.monthlyHours != null ? Number(body.monthlyHours) : existing.monthly_hours,
    body.vacationDaysTotal != null ? Number(body.vacationDaysTotal) : existing.vacation_days_total,
    body.vacationDaysUsed != null ? Number(body.vacationDaysUsed) : existing.vacation_days_used,
    body.color != null ? String(body.color) : existing.color,
    body.cashRegisterCardNumber != null ? String(body.cashRegisterCardNumber) : existing.cash_register_card_number,
    body.terminalEnabled === false ? 0 : body.terminalEnabled === true ? 1 : existing.terminal_enabled,
    body.timeTrackingEnabled === false ? 0 : body.timeTrackingEnabled === true ? 1 : existing.time_tracking_enabled,
    body.startDate != null ? String(body.startDate) : existing.start_date,
    body.endDate !== undefined ? (body.endDate == null ? null : String(body.endDate)) : existing.end_date,
    body.notes != null ? String(body.notes) : existing.notes,
    ts,
    id,
  )

  if (Array.isArray(body.workAreaIds)) {
    db.prepare(`DELETE FROM employee_work_areas WHERE employee_id = ?`).run(id)
    const insWa = db.prepare(`INSERT INTO employee_work_areas (id, employee_id, work_area_id) VALUES (?, ?, ?)`)
    for (const wid of body.workAreaIds as string[]) {
      insWa.run(randomUUID(), id, wid)
    }
  }

  return getEmployee(db, id)
}

export function softDeleteEmployee(db: Database, id: string) {
  const ts = nowIso()
  const r = db
    .prepare(
      `UPDATE employees SET active = 0, status = 'inactive', employee_access_enabled = 0, updated_at = ? WHERE id = ?`,
    )
    .run(ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
}

export function getEmployeeRowInternal(db: Database, id: string): EmployeeRow | undefined {
  return db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id) as EmployeeRow | undefined
}

export function regenerateEmployeeAccessToken(db: Database, id: string) {
  const ts = nowIso()
  const tok = randomBytes(32).toString('hex')
  const r = db
    .prepare(
      `UPDATE employees SET employee_access_token = ?, employee_access_created_at = ?, employee_access_enabled = 1, updated_at = ? WHERE id = ?`,
    )
    .run(tok, ts, ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  return getEmployee(db, id, true)
}

export function setEmployeeAccessEnabled(db: Database, id: string, enabled: boolean) {
  const ts = nowIso()
  const r = db
    .prepare(`UPDATE employees SET employee_access_enabled = ?, updated_at = ? WHERE id = ?`)
    .run(enabled ? 1 : 0, ts, id)
  if (r.changes === 0) throw new Error('Mitarbeiter nicht gefunden')
  return getEmployee(db, id, true)
}
