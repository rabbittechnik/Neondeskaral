import type { Database } from 'better-sqlite3'
import { eachYmdInRangeInclusive } from '../utils/berlinCalendarWorkHours.js'

const FALLBACK_MIN_EUR = 13.9

type RateRow = { valid_from: string; hourly_rate: number }

const ratesByDb = new WeakMap<Database, RateRow[]>()
const hasTableByDb = new WeakMap<Database, boolean>()

function loadRates(db: Database): RateRow[] {
  let rates = ratesByDb.get(db)
  if (rates) return rates
  const tbl = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='minimum_wage_rates'`)
    .get() as { name: string } | undefined
  hasTableByDb.set(db, Boolean(tbl))
  if (!tbl) {
    rates = []
    ratesByDb.set(db, rates)
    return rates
  }
  rates = db
    .prepare(`SELECT valid_from, hourly_rate FROM minimum_wage_rates ORDER BY valid_from ASC`)
    .all() as RateRow[]
  ratesByDb.set(db, rates)
  return rates
}

export function preloadMinimumWageRates(db: Database): void {
  loadRates(db)
}

export function getMinimumWageForDateCached(db: Database, ymd: string): number {
  const rates = loadRates(db)
  if (!rates.length) return FALLBACK_MIN_EUR
  let best: RateRow | null = null
  for (const r of rates) {
    if (r.valid_from <= ymd) best = r
    else break
  }
  const n = Number(best?.hourly_rate)
  return Number.isFinite(n) && n > 0 ? n : FALLBACK_MIN_EUR
}

export function maxMinimumWageInRangeCached(db: Database, fromYmd: string, toYmd: string): number {
  let m = 0
  for (const d of eachYmdInRangeInclusive(fromYmd, toYmd)) {
    m = Math.max(m, getMinimumWageForDateCached(db, d))
  }
  return m > 0 ? m : FALLBACK_MIN_EUR
}

export function invalidateMinimumWageCache(db: Database): void {
  ratesByDb.delete(db)
  hasTableByDb.delete(db)
}
