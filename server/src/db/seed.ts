import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { FULL_STATION_PERMISSIONS, TEAMLEAD_PERMISSIONS } from '../constants/permissions.js'
import { nowIso } from '../utils/timestamps.js'
const STATION_ID = 'aral-bodelshausen'

type EmpSeed = {
  id: string
  first_name: string
  last_name: string
  display_name: string
  email: string
  phone: string
  birthday: string
  role: string
  employment_type: string
  hourly_wage: number
  monthly_salary: number | null
  weekly_hours: number
  monthly_hours: number
  vacation_days_total: number
  vacation_days_used: number
  color: string
  cash_register_card_number: string
  terminal_enabled: number
  time_tracking_enabled: number
  start_date: string
  notes: string
  work_area_ids: string[]
}

const EMPLOYEES: EmpSeed[] = [
  {
    id: 'e1',
    first_name: 'Mathias',
    last_name: 'Raselowski',
    display_name: 'Mathias Raselowski',
    email: 'mathias.raselowski@station.demo',
    phone: '+49 170 0000001',
    birthday: '1985-03-12',
    role: 'Schichtleiter',
    employment_type: 'vollzeit',
    hourly_wage: 15,
    monthly_salary: 2600,
    weekly_hours: 40,
    monthly_hours: 163.5,
    vacation_days_total: 30,
    vacation_days_used: 20,
    color: '#2dd4bf',
    cash_register_card_number: '772839',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2019-01-15',
    notes: 'Hauptansprechpartner Frühschicht.',
    work_area_ids: ['kasse', 'buero', 'lager'],
  },
  {
    id: 'e2',
    first_name: 'Bianca',
    last_name: 'Hornung',
    display_name: 'Bianca Hornung',
    email: 'bianca.hornung@station.demo',
    phone: '+49 170 0000002',
    birthday: '1992-07-22',
    role: 'Verkäufer',
    employment_type: 'vollzeit',
    hourly_wage: 14.5,
    monthly_salary: null,
    weekly_hours: 40,
    monthly_hours: 155,
    vacation_days_total: 28,
    vacation_days_used: 18,
    color: '#ec4899',
    cash_register_card_number: '1002',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2020-04-01',
    notes: '',
    work_area_ids: ['kasse', 'backshop'],
  },
  {
    id: 'e3',
    first_name: 'Max',
    last_name: 'Vins',
    display_name: 'Max Vins',
    email: 'max.vins@station.demo',
    phone: '+49 170 0000003',
    birthday: '1998-11-03',
    role: 'Chef / Administrator',
    employment_type: 'teilzeit',
    hourly_wage: 13.5,
    monthly_salary: null,
    weekly_hours: 30,
    monthly_hours: 162.5,
    vacation_days_total: 25,
    vacation_days_used: 12,
    color: '#2563eb',
    cash_register_card_number: '140520',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2021-09-01',
    notes: '',
    work_area_ids: ['kasse', 'backshop'],
  },
  {
    id: 'e4',
    first_name: 'Metin',
    last_name: 'Özgür',
    display_name: 'Metin Özgür',
    email: 'metin.oezguer@station.demo',
    phone: '+49 170 0000004',
    birthday: '1988-01-30',
    role: 'Vollzeit',
    employment_type: 'vollzeit',
    hourly_wage: 15.5,
    monthly_salary: 2750,
    weekly_hours: 40,
    monthly_hours: 171,
    vacation_days_total: 30,
    vacation_days_used: 14,
    color: '#ea580c',
    cash_register_card_number: '772820',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2018-06-01',
    notes: '',
    work_area_ids: ['kasse', 'lager', 'wasch'],
  },
  {
    id: 'e5',
    first_name: 'Enise',
    last_name: 'A.',
    display_name: 'Enise A.',
    email: 'enise.a@station.demo',
    phone: '+49 170 0000005',
    birthday: '2001-05-18',
    role: 'Aushilfe',
    employment_type: 'aushilfe',
    hourly_wage: 12.5,
    monthly_salary: null,
    weekly_hours: 20,
    monthly_hours: 72,
    vacation_days_total: 0,
    vacation_days_used: 0,
    color: '#fb923c',
    cash_register_card_number: '772837',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2023-02-01',
    notes: '',
    work_area_ids: ['kasse', 'schule'],
  },
  {
    id: 'e6',
    first_name: 'Chiara',
    last_name: 'H.',
    display_name: 'Chiara H.',
    email: 'chiara.h@station.demo',
    phone: '+49 170 0000006',
    birthday: '1995-09-09',
    role: 'Aushilfe',
    employment_type: 'aushilfe',
    hourly_wage: 14,
    monthly_salary: null,
    weekly_hours: 40,
    monthly_hours: 158.75,
    vacation_days_total: 28,
    vacation_days_used: 10,
    color: '#dc2626',
    cash_register_card_number: '772822',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2019-11-11',
    notes: '',
    work_area_ids: ['kasse', 'wasch'],
  },
  {
    id: 'e7',
    first_name: 'Luca',
    last_name: 'Stöck',
    display_name: 'Luca Stöck',
    email: 'luca.stoeck@station.demo',
    phone: '+49 170 0000007',
    birthday: '1993-12-01',
    role: 'Aushilfe',
    employment_type: 'aushilfe',
    hourly_wage: 13.8,
    monthly_salary: null,
    weekly_hours: 35,
    monthly_hours: 164,
    vacation_days_total: 28,
    vacation_days_used: 8,
    color: '#06b6d4',
    cash_register_card_number: '140519',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2020-01-20',
    notes: '',
    work_area_ids: ['kasse', 'aussen'],
  },
  {
    id: 'e8',
    first_name: 'Valerina',
    last_name: 'Mustafa',
    display_name: 'Valerina Mustafa',
    email: 'valerina.mustafa@station.demo',
    phone: '+49 170 0000008',
    birthday: '2000-02-14',
    role: 'Aushilfe',
    employment_type: 'aushilfe',
    hourly_wage: 12,
    monthly_salary: null,
    weekly_hours: 15,
    monthly_hours: 48.5,
    vacation_days_total: 0,
    vacation_days_used: 0,
    color: '#9333ea',
    cash_register_card_number: '772838',
    terminal_enabled: 1,
    time_tracking_enabled: 1,
    start_date: '2022-08-15',
    notes: '',
    work_area_ids: ['kasse', 'lager'],
  },
]

const TASK_TITLES = [
  'Auffüllen und Vorziehen Spätschicht',
  'Backshop wurde geputzt',
  'Frühschicht Check',
  'Kaffeemaschine Putzauftrag',
  'Laden ist aufgefüllt und vorgezogen',
  'Minus-Liste prüfen',
  'Mittagcheck',
  'Außenbereich kontrollieren',
  'Waschanlage Sichtprüfung',
  'Regale reinigen',
  'Inventur Kraftstoffe',
  'DEKRA / TÜV Bericht vorbereiten',
]

const WORK_AREAS: {
  id: string
  name: string
  short_code: string
  color: string
  description: string
}[] = [
  { id: 'kasse', name: 'Kasse', short_code: 'K', color: '#22d3ee', description: '' },
  { id: 'buero', name: 'Büro', short_code: 'B', color: '#a78bfa', description: '' },
  { id: 'backshop', name: 'Backshop', short_code: 'Ba', color: '#fbbf24', description: '' },
  { id: 'lager', name: 'Lager', short_code: 'L', color: '#94a3b8', description: '' },
  { id: 'wasch', name: 'Waschanlage', short_code: 'W', color: '#38bdf8', description: '' },
  { id: 'aussen', name: 'Außenbereich', short_code: 'A', color: '#4ade80', description: '' },
  { id: 'schule', name: 'Schule', short_code: 'Sch', color: '#2dd4bf', description: '' },
  { id: 'reinigung', name: 'Reinigung', short_code: 'Re', color: '#64748b', description: '' },
]

function tableCount(db: Database.Database, table: string): number {
  const exists = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`)
    .get(table) as { ok: number } | undefined
  if (!exists) return 0
  const row = db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get() as { c: number }
  return row.c ?? 0
}

/** True only if alle Kern-Tabellen leer — verhindert Demo-Seed nach Restore mit leeren Mitarbeitern. */
export function isDatabaseReallyEmpty(db: Database.Database): boolean {
  const tables = [
    'employees',
    'stations',
    'shifts',
    'time_entries',
    'absences',
    'tasks',
    'tuv_reports',
  ] as const
  return tables.every((t) => tableCount(db, t) === 0)
}

function shouldRunDemoSeed(db: Database.Database): boolean {
  if (!isDatabaseReallyEmpty(db)) return false
  if (process.env.SEED_DEMO === '1') return true
  if (process.env.NODE_ENV === 'production') return false
  return true
}

export function seedIfEmpty(db: Database.Database) {
  if (!shouldRunDemoSeed(db)) return

  const ts = nowIso()
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO stations (id, name, brand, address, city, postal_code, phone, email, federal_state, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      STATION_ID,
      'Aral Bodelshausen',
      'Aral',
      'Bahnhofstraße 1',
      'Bodelshausen',
      '72411',
      '+49 7471 0000',
      'info@aral-bodelshausen.demo',
      'BW',
      ts,
      ts,
    )

    const insWa = db.prepare(
      `INSERT INTO work_areas (id, station_id, name, short_code, color, description, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    for (const w of WORK_AREAS) {
      insWa.run(w.id, STATION_ID, w.name, w.short_code, w.color, w.description, ts, ts)
    }

    db.prepare(
      `INSERT INTO roles (id, name, description, permissions_json, role_key, role_label) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'role-admin',
      'Chef',
      'Chef / Administrator',
      JSON.stringify(FULL_STATION_PERMISSIONS),
      'chief_admin',
      'Chef / Administrator',
    )
    db.prepare(
      `INSERT INTO roles (id, name, description, permissions_json, role_key, role_label) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'role-station-team-lead',
      'Schichtleitung',
      'Schichtleitung',
      JSON.stringify(TEAMLEAD_PERMISSIONS),
      'station_team_lead',
      'Schichtleiter',
    )

    const hashMax = bcrypt.hashSync(process.env.ADMIN_MAX_PASSWORD ?? '00066777', 10)
    const hashMathias = bcrypt.hashSync(process.env.ADMIN_MATTHIAS_PASSWORD ?? '200520', 10)
    const maxUsername = String(process.env.ADMIN_MAX_USERNAME ?? 'max').trim().toLowerCase()
    const matUsername = String(process.env.ADMIN_MATTHIAS_USERNAME ?? 'mathias').trim().toLowerCase()

    const insUser = db.prepare(
      `INSERT INTO users (id, username, email, password_hash, display_name, role_id, global_admin, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    insUser.run(
      'user-max-vins',
      maxUsername,
      'max.vins@station.demo',
      hashMax,
      'Max Vins',
      'role-admin',
      1,
      ts,
      ts,
    )
    insUser.run(
      'user-mathias-raselowski',
      matUsername,
      'rabbit.technik@gmail.com',
      hashMathias,
      'Mathias Raselowski',
      'role-station-team-lead',
      0,
      ts,
      ts,
    )

    const insEmp = db.prepare(
      `INSERT INTO employees (
        id, station_id, first_name, last_name, display_name, email, phone, birthday, role, employment_type,
        hourly_wage, monthly_salary, weekly_hours, monthly_hours, vacation_days_total, vacation_days_used,
        color, status, cash_register_card_number, terminal_enabled, time_tracking_enabled,
        start_date, end_date, notes, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL, ?, 1, ?, ?)`,
    )

    const insEwa = db.prepare(
      `INSERT INTO employee_work_areas (id, employee_id, work_area_id) VALUES (?, ?, ?)`,
    )

    for (const e of EMPLOYEES) {
      insEmp.run(
        e.id,
        STATION_ID,
        e.first_name,
        e.last_name,
        e.display_name,
        e.email,
        e.phone,
        e.birthday,
        e.role,
        e.employment_type,
        e.hourly_wage,
        e.monthly_salary,
        e.weekly_hours,
        e.monthly_hours,
        e.vacation_days_total,
        e.vacation_days_used,
        e.color,
        e.cash_register_card_number,
        e.terminal_enabled,
        e.time_tracking_enabled,
        e.start_date,
        e.notes,
        ts,
        ts,
      )
      for (const wid of e.work_area_ids) {
        insEwa.run(randomUUID(), e.id, wid)
      }
    }

    const updEmpLine = db.prepare(
      `UPDATE employees SET role = ?, employment_role = ?, employment_type = ?, updated_at = ? WHERE id = ? AND station_id = ?`,
    )
    const tsUpd = nowIso()
    const lineJobs: { id: string; role: string; employment_role: string; employment_type: string }[] = [
      { id: 'e1', role: 'Schichtleiter', employment_role: 'Schichtleiter', employment_type: 'vollzeit' },
      { id: 'e3', role: 'Chef / Administrator', employment_role: 'Chef / Administrator', employment_type: 'teilzeit' },
      { id: 'e4', role: 'Vollzeit', employment_role: 'Vollzeit', employment_type: 'vollzeit' },
      { id: 'e5', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
      { id: 'e6', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
      { id: 'e7', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
      { id: 'e8', role: 'Aushilfe', employment_role: 'Aushilfe', employment_type: 'aushilfe' },
    ]
    for (const row of lineJobs) {
      updEmpLine.run(row.role, row.employment_role, row.employment_type, tsUpd, row.id, STATION_ID)
    }

    const updPlanning = db.prepare(
      `UPDATE employees SET
        preferred_shift_types_json = ?,
        preferred_work_days_json = ?,
        not_preferred_work_days_json = ?,
        can_work_weekends = ?,
        can_work_holidays = ?,
        max_preferred_days_per_week = ?,
        max_weekly_hours = ?,
        planning_notes = ?,
        updated_at = ?
      WHERE id = ?`,
    )
    const planTs = nowIso()
    const planningRows: {
      id: string
      shift: string
      days: string
      notDays: string
      wk: number
      hk: number
      maxDays: number | null
      maxH: number | null
      notes: string
    }[] = [
      {
        id: 'e1',
        shift: JSON.stringify(['early', 'middle']),
        days: JSON.stringify(['monday', 'wednesday', 'friday', 'saturday']),
        notDays: '[]',
        wk: 1,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
      {
        id: 'e2',
        shift: JSON.stringify(['early', 'late']),
        days: JSON.stringify(['monday', 'tuesday', 'wednesday']),
        notDays: '[]',
        wk: 0,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
      {
        id: 'e3',
        shift: JSON.stringify(['early']),
        days: JSON.stringify(['monday', 'tuesday', 'thursday', 'friday']),
        notDays: '[]',
        wk: 0,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
      {
        id: 'e4',
        shift: JSON.stringify(['late']),
        days: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
        notDays: '[]',
        wk: 1,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
      {
        id: 'e5',
        shift: JSON.stringify(['late', 'weekend']),
        days: JSON.stringify(['friday', 'saturday', 'sunday']),
        notDays: '[]',
        wk: 1,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
      {
        id: 'e6',
        shift: JSON.stringify(['early', 'weekend']),
        days: JSON.stringify(['saturday', 'sunday']),
        notDays: '[]',
        wk: 1,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
      {
        id: 'e7',
        shift: JSON.stringify(['middle', 'late']),
        days: JSON.stringify(['friday', 'saturday', 'sunday']),
        notDays: '[]',
        wk: 1,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
      {
        id: 'e8',
        shift: JSON.stringify(['late', 'weekend']),
        days: JSON.stringify(['sunday']),
        notDays: '[]',
        wk: 1,
        hk: 1,
        maxDays: null,
        maxH: null,
        notes: '',
      },
    ]
    for (const p of planningRows) {
      updPlanning.run(
        p.shift,
        p.days,
        p.notDays,
        p.wk,
        p.hk,
        p.maxDays,
        p.maxH,
        p.notes,
        planTs,
        p.id,
      )
    }

    const insAbs = db.prepare(
      `INSERT INTO absences (
         id, station_id, employee_id, type, start_date, end_date, half_day, status, comment,
         requested_at, approved_by, approved_at, rejected_by, rejected_at, rejected_reason,
         paid, counts_against_vacation, paid_hours_per_day, paid_hours_total, absence_days,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    )
    insAbs.run(
      'abs-1',
      STATION_ID,
      'e5',
      'paid_vacation',
      '2026-05-15',
      '2026-05-22',
      'requested',
      '',
      ts,
      null,
      null,
      1,
      1,
      8,
      64,
      8,
      ts,
      ts,
    )
    insAbs.run(
      'abs-2',
      STATION_ID,
      'e4',
      'paid_vacation',
      '2026-05-20',
      '2026-05-25',
      'requested',
      '',
      ts,
      null,
      null,
      1,
      1,
      8,
      48,
      6,
      ts,
      ts,
    )
    insAbs.run(
      'abs-3',
      STATION_ID,
      'e7',
      'sick',
      '2026-05-13',
      '2026-05-14',
      'approved',
      '',
      ts,
      'Station',
      ts,
      0,
      0,
      0,
      0,
      2,
      ts,
      ts,
    )
    insAbs.run(
      'abs-4',
      STATION_ID,
      'e8',
      'paid_vacation',
      '2026-05-01',
      '2026-05-03',
      'approved',
      '',
      ts,
      'Station',
      ts,
      1,
      1,
      8,
      24,
      3,
      ts,
      ts,
    )
    insAbs.run(
      'abs-5',
      STATION_ID,
      'e2',
      'day_off',
      '2026-05-28',
      '2026-05-28',
      'approved',
      'Frei',
      ts,
      'Station',
      ts,
      0,
      0,
      0,
      0,
      1,
      ts,
      ts,
    )

    const insVb = db.prepare(
      `INSERT INTO vacation_blocks (id, station_id, title, start_date, end_date, description, work_area_ids_json, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    insVb.run(
      'vb-1',
      STATION_ID,
      'Inventurwoche',
      '2026-06-01',
      '2026-06-07',
      'Reduzierte Urlaubsfreigabe',
      JSON.stringify(['kasse', 'lager']),
      ts,
      ts,
    )
    insVb.run(
      'vb-2',
      STATION_ID,
      'Sommerferien-Hauptzeit',
      '2026-07-15',
      '2026-08-31',
      'Mehr Aushilfen einplanen',
      JSON.stringify([]),
      ts,
      ts,
    )
    insVb.run(
      'vb-3',
      STATION_ID,
      'Weihnachten / Jahreswechsel',
      '2026-12-20',
      '2027-01-06',
      'Geschäftsführung informieren',
      JSON.stringify(['kasse', 'backshop']),
      ts,
      ts,
    )

    const insTask = db.prepare(
      `INSERT INTO tasks (
        id, station_id, title, description, work_area_id, assigned_type, assigned_employee_id, assigned_role,
        recurrence_type, start_date, end_date, weekdays_json, month_day, start_time, end_time,
        confirm_required, control_required, mandatory, priority, active, icon, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'all', NULL, NULL, 'weekly', '2026-01-01', NULL, ?, NULL, '06:00', '22:00', 0, 0, 0, 'normal', 1, NULL, 'seed', ?, ?)`,
    )
    const weekdays = JSON.stringify([1, 2, 3, 4, 5, 6])
    TASK_TITLES.forEach((title, i) => {
      const wid = WORK_AREAS[i % WORK_AREAS.length]!.id
      insTask.run(`task-seed-${i + 1}`, STATION_ID, title, 'Aus Phase-8-Seed', wid, weekdays, ts, ts)
    })

    const insTe = db.prepare(
      `INSERT INTO time_entries (id, station_id, employee_id, shift_id, start_at, end_at, break_minutes, status, source, started_by, ended_by, start_note, end_note, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    )
    insTe.run(
      'te-done-1',
      STATION_ID,
      'e7',
      '2026-05-11T14:02:00.000Z',
      '2026-05-11T21:16:00.000Z',
      30,
      'completed',
      'tablet',
      'Luca Stöck',
      'Luca Stöck',
      ts,
      ts,
    )
    insTe.run(
      'te-done-2',
      STATION_ID,
      'e5',
      '2026-05-11T22:00:00.000Z',
      '2026-05-12T06:00:00.000Z',
      30,
      'completed',
      'cash_register_card_terminal',
      'Terminal',
      'Terminal',
      ts,
      ts,
    )
  })

  tx()
}
