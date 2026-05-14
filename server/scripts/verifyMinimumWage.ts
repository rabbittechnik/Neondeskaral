/**
 * Schnellprüfung Mindestlohn-Logik (ohne Vitest).
 * Ausführen: npm run verify:min-wage  (im Ordner server)
 */
import Database from 'better-sqlite3'
import { runSchema } from '../src/db/schema.js'
import { ensureMinimumWageRatesSeeded } from '../src/db/migrations.js'
import {
  employmentTypeSubjectToStatutoryMinimum,
  firstValidFromWhenMinimumExceeds,
  getEffectiveHourlyRate,
  getMinimumWageForDate,
} from '../src/services/statutoryMinWageService.js'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
}

const db = new Database(':memory:')
runSchema(db)
ensureMinimumWageRatesSeeded(db)

assert(getMinimumWageForDate(db, '2026-05-15') === 13.9, 'Mai 2026 = 13,90')
assert(getMinimumWageForDate(db, '2027-02-15') === 14.6, 'Feb 2027 = 14,60')
assert(getMinimumWageForDate(db, '2025-06-01') === 12.82, 'Mitte 2025 = 12,82')

assert(
  getEffectiveHourlyRate(db, 'minijob', 12.86, '2026-05-01') === 13.9,
  'Chiara-Beispiel Minijob 12,86 → 13,90',
)
assert(getEffectiveHourlyRate(db, 'minijob', 12.82, '2026-05-01') === 13.9, 'Luca 12,82 → 13,90')
assert(getEffectiveHourlyRate(db, 'minijob', 13.9, '2026-05-01') === 13.9, 'Enise/Valerina 13,90')
assert(getEffectiveHourlyRate(db, 'minijob', 15, '2026-05-01') === 15, 'Minijob 15 bleibt 15')
assert(getEffectiveHourlyRate(db, 'vollzeit', 15, '2026-05-01') === 15, 'Vollzeit 15 unverändert')
assert(getEffectiveHourlyRate(db, 'vollzeit', 10, '2026-05-01') === 10, 'Vollzeit unter Mindestlohn: keine Anhebung')

assert(employmentTypeSubjectToStatutoryMinimum('minijob'), 'minijob subject')
assert(employmentTypeSubjectToStatutoryMinimum('aushilfe'), 'aushilfe subject')
assert(employmentTypeSubjectToStatutoryMinimum('geringfügig'), 'geringfügig subject')
assert(!employmentTypeSubjectToStatutoryMinimum('vollzeit'), 'vollzeit nicht subject')

const firstAbove1286 = firstValidFromWhenMinimumExceeds(db, 12.86)
assert(firstAbove1286 === '2026-01-01', `Stichtag über 12,86 erwartet 2026-01-01, war ${firstAbove1286}`)

db.prepare(`INSERT INTO minimum_wage_rates (id, valid_from, hourly_rate, note, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run(
  'test-mw-202607',
  '2026-07-01',
  20,
  'Test Stichtag',
)
assert(getMinimumWageForDate(db, '2026-06-30') === 13.9, 'Vor 01.07. weiter 13,90')
assert(getMinimumWageForDate(db, '2026-07-01') === 20, 'Ab 01.07. Test-Satz 20')
assert(getEffectiveHourlyRate(db, 'minijob', 12, '2026-06-30') === 13.9, 'Minijob Juni-Ende')
assert(getEffectiveHourlyRate(db, 'minijob', 12, '2026-07-02') === 20, 'Minijob nach Stichtag')

db.close()
// eslint-disable-next-line no-console
console.log('verifyMinimumWage: alle Prüfungen OK.')
