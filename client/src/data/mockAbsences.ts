import type { Absence, VacationBlock } from '../types/absence'

export const SEED_VACATION_BLOCKS: VacationBlock[] = [
  {
    id: 'vb-1',
    title: 'Inventurwoche',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    description: 'Kein Urlaub während Inventur.',
    workAreaIds: ['kasse', 'lager', 'backshop'],
    active: true,
  },
  {
    id: 'vb-2',
    title: 'Sommerferien-Hauptzeit',
    startDate: '2026-08-01',
    endDate: '2026-08-15',
    description: 'Urlaub nur nach Rücksprache mit Schichtleitung.',
    workAreaIds: ['kasse', 'backshop', 'aussen', 'wasch'],
    active: true,
  },
  {
    id: 'vb-3',
    title: 'Weihnachten / Jahreswechsel',
    startDate: '2026-12-20',
    endDate: '2027-01-03',
    description: 'Mindestbesetzung; Urlaub eingeschränkt.',
    workAreaIds: ['kasse', 'buero', 'lager'],
    active: true,
  },
]

export const SEED_ABSENCES: Absence[] = [
  {
    id: 'abs-1',
    employeeId: 'e5',
    type: 'urlaub',
    startDate: '2026-05-15',
    endDate: '2026-05-22',
    halfDay: false,
    status: 'beantragt',
    comment: 'Familienurlaub',
    requestedAt: '2026-05-02T10:00:00',
  },
  {
    id: 'abs-2',
    employeeId: 'e9',
    type: 'urlaub',
    startDate: '2026-05-20',
    endDate: '2026-05-25',
    halfDay: false,
    status: 'beantragt',
    comment: '',
    requestedAt: '2026-05-03T14:30:00',
  },
  {
    id: 'abs-3',
    employeeId: 'e7',
    type: 'krankheit',
    startDate: '2026-05-13',
    endDate: '2026-05-14',
    halfDay: false,
    status: 'genehmigt',
    comment: 'AU vorgelegt',
    requestedAt: '2026-05-12T07:00:00',
    approvedBy: 'Mathias Raselowski',
    approvedAt: '2026-05-12T08:15:00',
  },
  {
    id: 'abs-4',
    employeeId: 'e8',
    type: 'urlaub',
    startDate: '2026-05-01',
    endDate: '2026-05-03',
    halfDay: false,
    status: 'genehmigt',
    comment: '',
    requestedAt: '2026-04-20T09:00:00',
    approvedBy: 'Mathias Raselowski',
    approvedAt: '2026-04-21T11:00:00',
  },
  {
    id: 'abs-5',
    employeeId: 'e2',
    type: 'frei',
    startDate: '2026-05-28',
    endDate: '2026-05-28',
    halfDay: false,
    status: 'genehmigt',
    comment: 'Sonderfrei',
    requestedAt: '2026-05-01T12:00:00',
    approvedBy: 'Metin Özgür',
    approvedAt: '2026-05-01T12:30:00',
  },
]

export function cloneSeedAbsences(): Absence[] {
  return structuredClone(SEED_ABSENCES)
}

export function cloneSeedVacationBlocks(): VacationBlock[] {
  return structuredClone(SEED_VACATION_BLOCKS)
}

export function createAbsenceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `abs-${crypto.randomUUID()}`
  }
  return `abs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createVacationBlockId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `vb-${crypto.randomUUID()}`
  }
  return `vb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
