import type { GermanState } from './germanHolidays'

/** Physisches Tablet / Terminal ohne Admin-Session: feste Standard-Station. */
export const DEFAULT_TABLET_STATION_ID = 'aral-bodelshausen'

/** @deprecated Nutze useStation() in der Admin-App. */
export const STATION = {
  id: DEFAULT_TABLET_STATION_ID,
  name: 'Aral Bodelshausen',
  federalState: 'BW' as GermanState,
} as const

export const STATION_NAME = STATION.name
export const STATION_FEDERAL_STATE = STATION.federalState
