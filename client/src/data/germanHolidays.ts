/**
 * Deutsche Feiertage (Frontend-Dummy, später API/DB).
 * Datenstand: ausgewählte Termine 2026.
 */

export type GermanState =
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH'

export type HolidayScope = 'nationwide' | 'state'

export type GermanHoliday = {
  id: string
  name: string
  /** ISO YYYY-MM-DD */
  date: string
  scope: HolidayScope
  /** Bei bundesweit typischerweise 'ALL' */
  states: GermanState[] | 'ALL'
  type: 'public' | 'regional' | 'special'
  /** Hinweis z. B. für teilweise Geltung */
  note?: string
}

/** Auswahl wichtiger Feiertage 2026 */
export const GERMAN_HOLIDAYS: GermanHoliday[] = [
  {
    id: 'de-2026-neujahr',
    name: 'Neujahr',
    date: '2026-01-01',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
  {
    id: 'de-2026-heilige-drei-koenige',
    name: 'Heilige Drei Könige',
    date: '2026-01-06',
    scope: 'state',
    states: ['BW', 'BY', 'ST'],
    type: 'public',
  },
  {
    id: 'de-2026-frauentag',
    name: 'Internationaler Frauentag',
    date: '2026-03-08',
    scope: 'state',
    states: ['BE', 'MV'],
    type: 'public',
  },
  {
    id: 'de-2026-karfreitag',
    name: 'Karfreitag',
    date: '2026-04-03',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
  {
    id: 'de-2026-ostermontag',
    name: 'Ostermontag',
    date: '2026-04-06',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
  {
    id: 'de-2026-tag-der-arbeit',
    name: 'Tag der Arbeit',
    date: '2026-05-01',
    scope: 'nationwide',
    states: 'ALL',
    type: 'special',
  },
  {
    id: 'de-2026-christi-himmelfahrt',
    name: 'Christi Himmelfahrt',
    date: '2026-05-14',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
  {
    id: 'de-2026-pfingstmontag',
    name: 'Pfingstmontag',
    date: '2026-05-25',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
  {
    id: 'de-2026-fronleichnam',
    name: 'Fronleichnam',
    date: '2026-06-04',
    scope: 'state',
    states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
    type: 'public',
  },
  {
    id: 'de-2026-mariae-himmelfahrt',
    name: 'Mariä Himmelfahrt',
    date: '2026-08-15',
    scope: 'state',
    states: ['SL', 'BY'],
    type: 'public',
    note:
      'In Bayern nur in überwiegend katholischen Gemeinden gesetzlicher Feiertag; vollständig gesetzlich im Saarland.',
  },
  {
    id: 'de-2026-weltkindertag',
    name: 'Weltkindertag',
    date: '2026-09-20',
    scope: 'state',
    states: ['TH'],
    type: 'public',
  },
  {
    id: 'de-2026-tag-der-deutschen-einheit',
    name: 'Tag der Deutschen Einheit',
    date: '2026-10-03',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
  {
    id: 'de-2026-reformationstag',
    name: 'Reformationstag',
    date: '2026-10-31',
    scope: 'state',
    states: ['BB', 'MV', 'SN', 'ST', 'TH', 'SH', 'NI', 'HB', 'HH'],
    type: 'public',
  },
  {
    id: 'de-2026-allerheiligen',
    name: 'Allerheiligen',
    date: '2026-11-01',
    scope: 'state',
    states: ['BW', 'BY', 'NW', 'RP', 'SL'],
    type: 'public',
  },
  {
    id: 'de-2026-buss-und-bettag',
    name: 'Buß- und Bettag',
    date: '2026-11-18',
    scope: 'state',
    states: ['SN'],
    type: 'public',
  },
  {
    id: 'de-2026-weihnachten-1',
    name: '1. Weihnachtsfeiertag',
    date: '2026-12-25',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
  {
    id: 'de-2026-weihnachten-2',
    name: '2. Weihnachtsfeiertag',
    date: '2026-12-26',
    scope: 'nationwide',
    states: 'ALL',
    type: 'public',
  },
]
