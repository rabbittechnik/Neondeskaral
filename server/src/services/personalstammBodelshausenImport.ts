import type { Database } from 'better-sqlite3'
import { nowIso } from '../utils/timestamps.js'

const STATION_ID = 'aral-bodelshausen'

const RV_NOTE =
  '[Personalakte] Befreiung Rentenversicherungspflicht (Minijob): vorhanden laut Personalbogen (keine digitale Ablage im System).'

function appendUniqueNote(existing: string | null | undefined, block: string): string {
  const cur = String(existing ?? '').trim()
  if (!block.trim()) return cur
  if (cur.includes(block.trim())) return cur
  return cur ? `${cur}\n\n${block}` : block
}

function mergeRvNote(existing: string | null | undefined): string {
  return appendUniqueNote(existing, RV_NOTE)
}

function vacationTotalSafe(annual: number, usedRaw: number | null | undefined): number {
  const used = Number(usedRaw ?? 0) || 0
  return Math.max(annual, used)
}

type EmpPatch = {
  displayName: string
  /** role + employment_role unverändert lassen (Chef / Stationsleitung …) */
  freezeJobTitles: boolean
  salutation: string
  firstName: string
  lastName: string
  /** null = Geburtsdatum im Profil leeren (nur wenn Personalbogen leer) */
  birthday: string | null
  clearBirthday?: boolean
  mobile: string | null
  email: string | null
  employmentType: string
  employmentRole?: string
  startDate: string
  payType: string
  hourlyWage: number | null
  monthlySalary: number | null
  mankoMoney: number
  annualVacationDays: number
  vacationHoursPerDay: number
  surchargeMode: string
  nightStart: string | null
  nightEnd: string | null
  nightPct: number | null
  satPct: number | null
  sunPct: number | null
  holPct: number | null
  specHolPct: number | null
  n04: number | null
  n04Sun: number | null
  n04Hol: number | null
  n04Spec: number | null
  rvNote: boolean
}

const PATCHES: EmpPatch[] = [
  {
    displayName: 'Max Vins',
    freezeJobTitles: true,
    salutation: 'herr',
    firstName: 'Max',
    lastName: 'Vins',
    birthday: '1998-10-18',
    mobile: null,
    email: null,
    employmentType: 'vollzeit',
    startDate: '2024-10-04',
    payType: 'monthly',
    hourlyWage: null,
    monthlySalary: 0,
    mankoMoney: 0,
    annualVacationDays: 25,
    vacationHoursPerDay: 8,
    surchargeMode: 'none',
    nightStart: null,
    nightEnd: null,
    nightPct: null,
    satPct: null,
    sunPct: null,
    holPct: null,
    specHolPct: null,
    n04: null,
    n04Sun: null,
    n04Hol: null,
    n04Spec: null,
    rvNote: false,
  },
  {
    displayName: 'Chiara H.',
    freezeJobTitles: false,
    salutation: 'frau',
    firstName: 'Chiara',
    lastName: 'H.',
    birthday: '1998-04-08',
    mobile: null,
    email: null,
    employmentType: 'minijob',
    employmentRole: 'Minijob / Aushilfe',
    startDate: '2025-10-01',
    payType: 'hourly',
    hourlyWage: 12.86,
    monthlySalary: null,
    mankoMoney: 0,
    annualVacationDays: 8,
    vacationHoursPerDay: 8,
    surchargeMode: 'none',
    nightStart: null,
    nightEnd: null,
    nightPct: null,
    satPct: null,
    sunPct: null,
    holPct: null,
    specHolPct: null,
    n04: null,
    n04Sun: null,
    n04Hol: null,
    n04Spec: null,
    rvNote: true,
  },
  {
    displayName: 'Enise A.',
    freezeJobTitles: false,
    salutation: 'frau',
    firstName: 'Enise',
    lastName: 'A.',
    birthday: '2006-10-04',
    mobile: '017664952327',
    email: null,
    employmentType: 'minijob',
    employmentRole: 'Minijob / Aushilfe',
    startDate: '2026-02-16',
    payType: 'hourly',
    hourlyWage: 13.9,
    monthlySalary: null,
    mankoMoney: 0,
    annualVacationDays: 8,
    vacationHoursPerDay: 8,
    surchargeMode: 'none',
    nightStart: null,
    nightEnd: null,
    nightPct: null,
    satPct: null,
    sunPct: null,
    holPct: null,
    specHolPct: null,
    n04: null,
    n04Sun: null,
    n04Hol: null,
    n04Spec: null,
    rvNote: true,
  },
  {
    displayName: 'Luca Stöck',
    freezeJobTitles: false,
    salutation: 'herr',
    firstName: 'Luca',
    lastName: 'Stöck',
    birthday: '2006-02-10',
    mobile: '015736539443',
    email: 'luca.stoeck@t-online.de',
    employmentType: 'minijob',
    employmentRole: 'Minijob / Aushilfe',
    startDate: '2024-06-05',
    payType: 'hourly',
    hourlyWage: 12.82,
    monthlySalary: null,
    mankoMoney: 0,
    annualVacationDays: 3,
    vacationHoursPerDay: 8,
    surchargeMode: 'none',
    nightStart: null,
    nightEnd: null,
    nightPct: null,
    satPct: null,
    sunPct: null,
    holPct: null,
    specHolPct: null,
    n04: null,
    n04Sun: null,
    n04Hol: null,
    n04Spec: null,
    rvNote: true,
  },
  {
    displayName: 'Mathias Raselowski',
    freezeJobTitles: true,
    salutation: 'herr',
    firstName: 'Mathias',
    lastName: 'Raselowski',
    birthday: '1986-03-20',
    mobile: null,
    email: null,
    employmentType: 'vollzeit',
    startDate: '2021-06-02',
    payType: 'hourly',
    hourlyWage: 15,
    monthlySalary: null,
    mankoMoney: 0,
    annualVacationDays: 25,
    vacationHoursPerDay: 8,
    surchargeMode: 'individual',
    nightStart: '20:00',
    nightEnd: '06:00',
    nightPct: 25,
    satPct: null,
    sunPct: 50,
    holPct: 125,
    specHolPct: 150,
    n04: null,
    n04Sun: null,
    n04Hol: null,
    n04Spec: null,
    rvNote: false,
  },
  {
    displayName: 'Metin Özgür',
    freezeJobTitles: true,
    salutation: 'herr',
    firstName: 'Metin',
    lastName: 'Özgür',
    birthday: '1969-02-08',
    mobile: null,
    email: null,
    employmentType: 'vollzeit',
    startDate: '2023-09-12',
    payType: 'monthly',
    hourlyWage: null,
    monthlySalary: 0,
    mankoMoney: 0,
    annualVacationDays: 25,
    vacationHoursPerDay: 8,
    surchargeMode: 'individual',
    nightStart: '00:00',
    nightEnd: '04:00',
    nightPct: 25,
    satPct: null,
    sunPct: 50,
    holPct: 125,
    specHolPct: 150,
    n04: 40,
    n04Sun: 50,
    n04Hol: 125,
    n04Spec: 150,
    rvNote: false,
  },
  {
    displayName: 'Valerina Mustafa',
    freezeJobTitles: false,
    salutation: 'frau',
    firstName: 'Valerina',
    lastName: 'Mustafa',
    birthday: null,
    clearBirthday: true,
    mobile: '015206334133',
    email: null,
    employmentType: 'minijob',
    employmentRole: 'Minijob / Aushilfe',
    startDate: '2026-04-01',
    payType: 'hourly',
    hourlyWage: 13.9,
    monthlySalary: null,
    mankoMoney: 0,
    annualVacationDays: 8,
    vacationHoursPerDay: 8,
    surchargeMode: 'none',
    nightStart: null,
    nightEnd: null,
    nightPct: null,
    satPct: null,
    sunPct: null,
    holPct: null,
    specHolPct: null,
    n04: null,
    n04Sun: null,
    n04Hol: null,
    n04Spec: null,
    rvNote: true,
  },
]

/**
 * Stammdaten aus Personalbögen für bestehende Mitarbeitende Aral Bodelshausen (keine neuen Datensätze, keine Löschungen).
 */
export function applyPersonalstammBodelshausen2026(db: Database): {
  updated: number
  skipped: string[]
  stationUpdated: boolean
} {
  const ts = nowIso()
  const skipped: string[] = []
  let updated = 0

  const st = db.prepare(`SELECT id FROM stations WHERE id = ?`).get(STATION_ID) as { id: string } | undefined
  let stationUpdated = false
  if (st) {
    db.prepare(
      `UPDATE stations SET street = ?, house_number = ?, postal_code = ?, city = ?, address = ?, updated_at = ? WHERE id = ?`,
    ).run('Bahnhofstraße', '84', '72411', 'Bodelshausen', 'Bahnhofstraße 84, 72411 Bodelshausen', ts, STATION_ID)
    stationUpdated = true
  }

  const sel = db.prepare(
    `SELECT id, vacation_days_used, notes, role, employment_role, wage_adjustment_note FROM employees WHERE station_id = ? AND display_name = ? AND (deleted_at IS NULL OR trim(deleted_at) = '')`,
  )

  const upd = db.prepare(
    `UPDATE employees SET
      salutation = ?,
      first_name = ?,
      last_name = ?,
      display_name = ?,
      birthday = ?,
      mobile_phone = COALESCE(?, mobile_phone),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      employment_type = ?,
      employment_role = ?,
      role = ?,
      start_date = ?,
      pay_type = ?,
      hourly_wage = ?,
      monthly_salary = ?,
      manko_money = ?,
      annual_vacation_days = ?,
      vacation_days_total = ?,
      vacation_hours_per_day = ?,
      surcharge_mode = ?,
      night_surcharge_percent = ?,
      night_surcharge_start = ?,
      night_surcharge_end = ?,
      saturday_surcharge_percent = ?,
      sunday_surcharge_percent = ?,
      holiday_surcharge_percent = ?,
      special_holiday_surcharge_percent = ?,
      night_0_4_surcharge_percent = ?,
      night_0_4_after_sunday_percent = ?,
      night_0_4_after_holiday_percent = ?,
      night_0_4_after_special_holiday_percent = ?,
      wage_adjustment_note = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
  )

  for (const p of PATCHES) {
    const row = sel.get(STATION_ID, p.displayName) as
      | {
          id: string
          vacation_days_used: number | null
          notes: string | null
          role: string | null
          employment_role: string | null
          wage_adjustment_note: string | null
        }
      | undefined
    if (!row) {
      skipped.push(p.displayName)
      continue
    }

    const hourlyOut =
      p.payType === 'monthly' && (p.hourlyWage == null || p.hourlyWage <= 0) ? null : (p.hourlyWage ?? null)
    const wageNoteOut = row.wage_adjustment_note

    let notes = row.notes ?? ''
    if (p.rvNote) notes = mergeRvNote(notes)

    const vacTotal = vacationTotalSafe(p.annualVacationDays, row.vacation_days_used)

    const roleOut = row.role
    const employmentRoleOut = p.freezeJobTitles ? row.employment_role : (p.employmentRole ?? row.employment_role)

    const mobileSet = p.mobile != null && p.mobile.trim() !== '' ? p.mobile.trim() : null
    const emailSet = p.email != null && p.email.trim() !== '' ? p.email.trim() : null

    const birthdayVal = p.clearBirthday ? null : p.birthday

    upd.run(
      p.salutation,
      p.firstName,
      p.lastName,
      p.displayName,
      birthdayVal,
      mobileSet,
      mobileSet,
      emailSet,
      p.employmentType,
      employmentRoleOut,
      roleOut,
      p.startDate,
      p.payType,
      hourlyOut,
      p.monthlySalary === null ? null : p.monthlySalary,
      p.mankoMoney,
      p.annualVacationDays,
      vacTotal,
      p.vacationHoursPerDay,
      p.surchargeMode,
      p.nightPct,
      p.nightStart,
      p.nightEnd,
      p.satPct,
      p.sunPct,
      p.holPct,
      p.specHolPct,
      p.n04,
      p.n04Sun,
      p.n04Hol,
      p.n04Spec,
      wageNoteOut,
      notes,
      ts,
      row.id,
    )
    updated += 1
  }

  return { updated, skipped, stationUpdated }
}
