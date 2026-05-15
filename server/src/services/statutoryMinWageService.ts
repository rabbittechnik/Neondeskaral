import type { Database } from 'better-sqlite3'
import { getMinimumWageForDateCached, preloadMinimumWageRates } from './minimumWageCache.js'

const FALLBACK_MIN_EUR = 13.9

/** Gesetzlicher Mindestlohn (Stundenlohn) zum Kalendertag YYYY-MM-DD (gecachte Tabelle). */
export function getMinimumWageForDate(db: Database, ymd: string): number {
  preloadMinimumWageRates(db)
  return getMinimumWageForDateCached(db, ymd)
}

/** Erstes `valid_from` (aufsteigend), an dem der geltende Mindestlohn über dem eingetragenen Satz liegt (für Hinweistexte). */
export function firstValidFromWhenMinimumExceeds(db: Database, rawHourlyWage: number): string | undefined {
  const rows = db
    .prepare(`SELECT valid_from FROM minimum_wage_rates ORDER BY valid_from ASC`)
    .all() as { valid_from: string }[]
  for (const { valid_from } of rows) {
    const min = getMinimumWageForDate(db, valid_from)
    if (min > rawHourlyWage + 0.003) return valid_from
  }
  return undefined
}

/** @deprecated Alias — bitte getMinimumWageForDate verwenden */
export function statutoryMinHourlyWageEurForReferenceDate(db: Database, ymd: string): number {
  return getMinimumWageForDate(db, ymd)
}

export function employmentTypeSubjectToStatutoryMinimum(employmentType: string): boolean {
  const t = String(employmentType ?? '')
    .toLowerCase()
    .trim()
  return t === 'minijob' || t === 'aushilfe' || t.includes('gering')
}

/**
 * Effektiver Stundenlohn für einen Kalendertag (Minijob/Aushilfe/geringfügig: mindestens Mindestlohn).
 * Vollzeit/Teilzeit/etc.: nur eingetragener Wert, keine automatische Anhebung.
 */
export function getEffectiveHourlyRate(db: Database, employmentType: string, rawHourlyWage: number, ymd: string): number {
  if (!employmentTypeSubjectToStatutoryMinimum(employmentType)) {
    return Number.isFinite(rawHourlyWage) && rawHourlyWage > 0 ? rawHourlyWage : 0
  }
  const min = getMinimumWageForDate(db, ymd)
  if (!Number.isFinite(rawHourlyWage) || rawHourlyWage <= 0) return min
  return Math.max(rawHourlyWage, min)
}

/**
 * Effektiver Stundenlohn für Lohnberechnung, wenn im gesamten Zeitraum ein fester Satz genügt (kein Tages-Split).
 * @deprecated Für Zeiträume mit Mindestlohn-Wechsel getEffectiveHourlyRate je Kalendertag nutzen.
 */
export function effectiveHourlyWageForPayroll(
  db: Database,
  employmentType: string,
  rawHourlyWage: number,
  periodFromYmd: string,
): number {
  return getEffectiveHourlyRate(db, employmentType, rawHourlyWage, periodFromYmd)
}
