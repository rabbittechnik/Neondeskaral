/** BW-Feiertagslogik für Planungs-Assistent (2026, synchron zum Frontend). */

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

export type GermanHoliday = {
  id: string
  name: string
  date: string
  scope: 'nationwide' | 'state'
  states: GermanState[] | 'ALL'
}

export const GERMAN_HOLIDAYS_2026: GermanHoliday[] = [
  { id: 'de-2026-neujahr', name: 'Neujahr', date: '2026-01-01', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-heilige-drei-koenige', name: 'Heilige Drei Könige', date: '2026-01-06', scope: 'state', states: ['BW', 'BY', 'ST'] },
  { id: 'de-2026-karfreitag', name: 'Karfreitag', date: '2026-04-03', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-ostermontag', name: 'Ostermontag', date: '2026-04-06', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-tag-der-arbeit', name: 'Tag der Arbeit', date: '2026-05-01', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-christi-himmelfahrt', name: 'Christi Himmelfahrt', date: '2026-05-14', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-pfingstmontag', name: 'Pfingstmontag', date: '2026-05-25', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-fronleichnam', name: 'Fronleichnam', date: '2026-06-04', scope: 'state', states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] },
  { id: 'de-2026-tag-der-deutschen-einheit', name: 'Tag der Deutschen Einheit', date: '2026-10-03', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-allerheiligen', name: 'Allerheiligen', date: '2026-11-01', scope: 'state', states: ['BW', 'BY', 'NW', 'RP', 'SL'] },
  { id: 'de-2026-weihnachten-1', name: '1. Weihnachtsfeiertag', date: '2026-12-25', scope: 'nationwide', states: 'ALL' },
  { id: 'de-2026-weihnachten-2', name: '2. Weihnachtsfeiertag', date: '2026-12-26', scope: 'nationwide', states: 'ALL' },
]

export function holidayAppliesToState(h: GermanHoliday, state: GermanState): boolean {
  if (h.scope === 'nationwide' || h.states === 'ALL') return true
  return Array.isArray(h.states) && h.states.includes(state)
}

export function getHolidayBadgeForDate(date: string, state: GermanState): {
  severity: 'strong' | 'soft' | 'none'
  label: string
} {
  const all = GERMAN_HOLIDAYS_2026.filter((h) => h.date === date)
  const relevant = all.filter((h) => holidayAppliesToState(h, state))
  if (relevant.length > 0) {
    return { severity: 'strong', label: relevant.map((h) => h.name).join(' · ') }
  }
  const other = all.filter((h) => !holidayAppliesToState(h, state))
  if (other.length > 0) {
    return { severity: 'soft', label: other.map((h) => h.name).join(' · ') }
  }
  return { severity: 'none', label: '' }
}
