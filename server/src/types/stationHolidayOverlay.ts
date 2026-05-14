/** Zusatz-Feiertage pro Station (Lohn / Anzeige) — unveränderliche Sets/Maps pro Reportlauf. */
export type StationHolidayOverlay = {
  extraPublicDates: Set<string>
  extraNames: Map<string, string>
  specialAllDayDates: Set<string>
}

export function emptyStationHolidayOverlay(): StationHolidayOverlay {
  return {
    extraPublicDates: new Set(),
    extraNames: new Map(),
    specialAllDayDates: new Set(),
  }
}
