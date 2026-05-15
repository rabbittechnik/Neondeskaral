import type Database from 'better-sqlite3'

/** Nur eindeutige System-Platzhalter (keine echten Stempelungen). */
export function isPlaceholderTimeEntryRow(row: {
  start_at: string
  end_at: string | null
  employee_id: string | null
  shift_id: string | null
  source: string | null
  status: string | null
}): boolean {
  if (!row.employee_id?.trim()) return true
  if (row.shift_id?.trim()) return false
  const src = String(row.source ?? '').toLowerCase()
  if (src !== 'system') return false
  if (row.status !== 'completed' || !row.end_at) return false

  const startHm = berlinHm(row.start_at)
  const endHm = berlinHm(row.end_at)
  if (startHm === '00:00' && (endHm === '08:00' || endHm === '00:00')) return true
  return false
}

function berlinHm(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  })
}

export function prunePlaceholderTimeEntries(
  db: Database.Database,
  stationId: string,
  opts?: { dryRun?: boolean },
): { scanned: number; deleted: number; ids: string[] } {
  const rows = db
    .prepare(
      `SELECT id, start_at, end_at, employee_id, shift_id, source, status
       FROM time_entries
       WHERE station_id = ?`,
    )
    .all(stationId) as {
    id: string
    start_at: string
    end_at: string | null
    employee_id: string | null
    shift_id: string | null
    source: string | null
    status: string | null
  }[]

  const ids = rows.filter(isPlaceholderTimeEntryRow).map((r) => r.id)
  if (!opts?.dryRun && ids.length) {
    const del = db.prepare(`DELETE FROM time_entries WHERE id = ? AND station_id = ?`)
    for (const id of ids) del.run(id, stationId)
  }
  return { scanned: rows.length, deleted: ids.length, ids }
}
