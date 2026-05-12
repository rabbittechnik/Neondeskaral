import type { GermanState } from './germanHolidays'

/** Dummy-Station (später aus Backend / Kontext). */
export const STATION = {
  id: 'aral-bodelshausen',
  name: 'Aral Bodelshausen',
  federalState: 'BW' as GermanState,
} as const

export const STATION_NAME = STATION.name
export const STATION_FEDERAL_STATE = STATION.federalState
