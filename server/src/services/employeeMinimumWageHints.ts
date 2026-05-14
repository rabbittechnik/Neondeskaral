import type { Database } from 'better-sqlite3'
import type { EmployeeRow } from './employeeService.js'
import { todayIso } from '../utils/timestamps.js'
import {
  employmentTypeSubjectToStatutoryMinimum,
  firstValidFromWhenMinimumExceeds,
  getMinimumWageForDate,
} from './statutoryMinWageService.js'

function deYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}.${m}.${y}`
}

function rNum(row: Record<string, unknown>, k: string, fb = 0): number {
  const v = row[k]
  if (v == null || v === '') return fb
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

function isMonthlyWageRecipientLike(row: Record<string, unknown>): boolean {
  const raw = String(row.pay_type ?? row.wage_type ?? 'hourly')
    .toLowerCase()
    .trim()
  return (
    raw === 'monthly' ||
    raw === 'salary' ||
    raw === 'gehalt' ||
    raw === 'festgehalt' ||
    raw === 'salaried'
  )
}

export type EmployeeMinimumWageHints = {
  statutoryMinimumHourlyToday?: number
  minimumWageMinijobHint?: string
  /** Erklärung eingetragen vs. berechnet (Minijob/Aushilfe). */
  minimumWageProfilePayrollNote?: string
  minimumWageFestangestelltHint?: string
}

export function buildEmployeeMinimumWageHints(
  db: Database,
  row: EmployeeRow & Record<string, unknown>,
): EmployeeMinimumWageHints {
  const R = row as Record<string, unknown>
  const ymd = todayIso().slice(0, 10)
  const minToday = getMinimumWageForDate(db, ymd)
  const raw = rNum(R, 'hourly_wage', 0)
  const et = String(row.employment_type ?? '')
  const monthly = isMonthlyWageRecipientLike(R)
  const out: EmployeeMinimumWageHints = {
    statutoryMinimumHourlyToday: Math.round(minToday * 100) / 100,
  }

  if (monthly || raw <= 0) return out

  if (employmentTypeSubjectToStatutoryMinimum(et)) {
    if (raw + 0.003 < minToday) {
      out.minimumWageMinijobHint =
        'Hinweis: Der eingetragene Stundenlohn liegt unter dem gesetzlichen Mindestlohn. Für die Lohnabrechnung wird automatisch der gültige Mindestlohn verwendet.'
      const fromYmd = firstValidFromWhenMinimumExceeds(db, raw)
      const minAtNote = getMinimumWageForDate(db, fromYmd ?? ymd)
      const ab = fromYmd ? `ab ${deYmd(fromYmd)} ` : ''
      out.minimumWageProfilePayrollNote = `Für die Lohnabrechnung wird ${ab}automatisch der gesetzliche Mindestlohn von ${minAtNote.toFixed(2).replace('.', ',')} €/h verwendet (eingetragener Stundenlohn bleibt im Profil).`
    }
  } else if (raw + 0.003 < minToday) {
    out.minimumWageFestangestelltHint =
      'Hinweis: Der eingetragene Stundenlohn liegt unter dem gesetzlichen Mindestlohn. Bitte prüfen.'
  }

  return out
}
