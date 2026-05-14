/**
 * StationGuide-Urlaube Aral Bodelshausen prüfen/anlegen (idempotent).
 * Öffnet SQLite direkt (ohne initDatabase).
 * Ausführen: npx tsx scripts/ensureStationGuideVacationsBodelshausen2026.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ensureBodelshausenStationGuideVacations2026 } from '../src/services/stationGuideVacationImportService.js'

function resolveDbPath(): string {
  if (process.env.DATABASE_PATH?.trim()) return process.env.DATABASE_PATH.trim()
  const cwd = process.cwd()
  const p = path.join(cwd, 'data', 'neonshift.sqlite')
  if (fs.existsSync(p)) return p
  return path.join(cwd, '..', 'data', 'neonshift.sqlite')
}

const dbPath = resolveDbPath()
if (!fs.existsSync(dbPath)) {
  console.error(`Datenbank nicht gefunden: ${dbPath}`)
  process.exit(1)
}
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const { messages } = ensureBodelshausenStationGuideVacations2026(db)
console.log(messages.join('\n'))
console.log(`\nDatenbank: ${dbPath}`)
db.close()
