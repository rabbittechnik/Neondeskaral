/**
 * Einmaliger / wiederholbarer Import der Mai-2026-Schichten (01.–10.05.2026) für Aral Bodelshausen.
 * Keine April-Schichten, keine Löschungen, keine Duplikate (gleicher Mitarbeiter, Tag, Start, Ende).
 *
 * Ausführung aus dem Ordner `server`:
 *   npm run import:may2026-shifts
 *
 * Optional: DATABASE_PATH=... setzen (siehe src/db/database.ts).
 */
import 'dotenv/config'
import fs from 'node:fs'
import type Database from 'better-sqlite3'
import DatabaseCtor from 'better-sqlite3'
import { getDbPath } from '../src/db/database.js'
import { runSchema } from '../src/db/schema.js'
import { applyMay2026BodelshausenOfficeShifts } from '../src/services/may2026BodelshausenShiftImport.js'

function openDb(): Database.Database {
  const dbPath = getDbPath()
  if (!fs.existsSync(dbPath)) {
    console.error(
      JSON.stringify({
        ok: false,
        error: `Keine Datenbank-Datei gefunden: ${dbPath}. Bitte Server einmal starten oder DATABASE_PATH setzen.`,
      }),
    )
    process.exit(1)
  }
  const db = new DatabaseCtor(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runSchema(db)
  return db
}

function main() {
  const db = openDb()
  const result = applyMay2026BodelshausenOfficeShifts(db)
  console.log(JSON.stringify(result, null, 2))
  db.close()
  if (!result.ok) process.exitCode = 1
}

main()
