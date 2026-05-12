export type ShiftCell =
  | 'frueh'
  | 'spaet'
  | 'nacht'
  | 'schule'
  | 'frei'
  | 'mittel'
  | 'kurz'

export const shiftLegend: {
  key: ShiftCell
  label: string
  time: string
  className: string
}[] = [
  {
    key: 'frueh',
    label: 'Früh',
    time: '05:30 – 14:00',
    className: 'bg-emerald-500/90 text-emerald-950',
  },
  {
    key: 'spaet',
    label: 'Spät',
    time: '14:00 – 21:15',
    className: 'bg-sky-600/95 text-white',
  },
  {
    key: 'nacht',
    label: 'Nacht',
    time: '22:00 – 06:00',
    className: 'bg-violet-600/95 text-white',
  },
  {
    key: 'schule',
    label: 'Schule',
    time: '06:30 – 14:15',
    className: 'bg-cyan-500/90 text-cyan-950',
  },
  {
    key: 'frei',
    label: 'Frei',
    time: '',
    className: 'bg-white/5 text-[var(--text-faint)]',
  },
]

export const weekDays = [
  { short: 'Mo', date: '11.05.' },
  { short: 'Di', date: '12.05.' },
  { short: 'Mi', date: '13.05.' },
  { short: 'Do', date: '14.05.' },
  { short: 'Fr', date: '15.05.' },
  { short: 'Sa', date: '16.05.' },
  { short: 'So', date: '17.05.' },
]

export const scheduleRows: { name: string; cells: ShiftCell[] }[] = [
  {
    name: 'Mathias Raselowski',
    cells: ['frueh', 'spaet', 'frueh', 'spaet', 'frueh', 'frei', 'frei'],
  },
  {
    name: 'Bianca Hornung',
    cells: ['spaet', 'frueh', 'spaet', 'frueh', 'spaet', 'kurz', 'frei'],
  },
  {
    name: 'Max Vins',
    cells: ['frueh', 'frueh', 'schule', 'spaet', 'frueh', 'spaet', 'frei'],
  },
  {
    name: 'Metin Özgür',
    cells: ['nacht', 'frei', 'nacht', 'frei', 'nacht', 'spaet', 'spaet'],
  },
  {
    name: 'Luca Stöck',
    cells: ['mittel', 'mittel', 'spaet', 'frueh', 'frei', 'frueh', 'spaet'],
  },
  {
    name: 'Enise A.',
    cells: ['spaet', 'spaet', 'frueh', 'schule', 'spaet', 'frei', 'frei'],
  },
  {
    name: 'Chiara H.',
    cells: ['frueh', 'spaet', 'frei', 'frueh', 'spaet', 'frueh', 'spaet'],
  },
  {
    name: 'Valerina Mustafa',
    cells: ['frei', 'frueh', 'spaet', 'spaet', 'frueh', 'nacht', 'frei'],
  },
]

export const currentShifts = [
  {
    name: 'Max Vins',
    role: 'Kasse',
    start: '06:30',
    end: '14:00',
    progress: 0.62,
  },
  {
    name: 'Bianca Hornung',
    role: 'Backshop',
    start: '06:30',
    end: '14:00',
    progress: 0.58,
  },
  {
    name: 'Metin Özgür',
    role: 'Leitung',
    start: '06:30',
    end: '14:00',
    progress: 0.55,
  },
]

export const upcomingShifts = [
  { name: 'Luca Stöck', detail: 'Spät · 14:00', eta: 'in 3h 12m' },
  { name: 'Enise A.', detail: 'Kasse · 14:00', eta: 'in 4h 40m' },
  { name: 'Chiara H.', detail: 'Früh', eta: 'morgen' },
]

export const pendingAbsences = [
  {
    name: 'Valerina Mustafa',
    type: 'Urlaub',
    range: '20.05. – 27.05.',
  },
  { name: 'Luca Stöck', type: 'Krank', range: '14.05. – 15.05.' },
  { name: 'Enise A.', type: 'Urlaub', range: '02.06. – 09.06.' },
]

export const unfilledWarnings = [
  { day: 'Fr 15.05.', slot: 'Spät · Waschanlage', area: 'W' },
  { day: 'Sa 16.05.', slot: 'Früh · Kasse', area: 'K' },
]

export const birthdays = [
  { name: 'Bianca Hornung', date: '18.05.', inDays: 'in 6 Tagen' },
  { name: 'Metin Özgür', date: '22.05.', inDays: 'in 10 Tagen' },
]
