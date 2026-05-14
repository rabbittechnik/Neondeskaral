import type { Database } from 'better-sqlite3'
import {
  BODELSHAUSEN_STATIONGUIDE_ABSENCES_2026,
  syncBodelshausenStationGuideAbsences2026,
} from './stationGuideBodelshausenAbsences2026Sync.js'

export type StationGuideVacationSpec = { displayName: string; start: string; end: string }

/** Nur noch für Kompatibilität; die Daten liegen in `BODELSHAUSEN_STATIONGUIDE_ABSENCES_2026`. */
export const BODELSHAUSEN_STATIONGUIDE_VACATIONS_2026: StationGuideVacationSpec[] = []

export { BODELSHAUSEN_STATIONGUIDE_ABSENCES_2026 }

/**
 * Idempotent: StationGuide-Abwesenheiten 2026 (Urlaub, unbezahlt, Sonderurlaub, Krankheit).
 * @deprecated Bevorzugt `syncBodelshausenStationGuideAbsences2026` importieren.
 */
export function ensureBodelshausenStationGuideVacations2026(db: Database): { messages: string[] } {
  return syncBodelshausenStationGuideAbsences2026(db)
}
