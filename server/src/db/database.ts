import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { runSchema } from './schema.js'
import { runMigrations } from './migrations.js'
import { seedIfEmpty } from './seed.js'
import { seedImportedStationGuideSchedule } from './seedSchedule.js'

let dbInstance: Database.Database | null = null

export function getDbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH
  return path.join(process.cwd(), 'data', 'neonshift.sqlite')
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return dbInstance
}

export function initDatabase(): Database.Database {
  const dbPath = getDbPath()
  const dir = path.dirname(dbPath)
  fs.mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runSchema(db)
  runMigrations(db)
  seedIfEmpty(db)
  runMigrations(db)
  seedImportedStationGuideSchedule(db)
  dbInstance = db
  return db
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
