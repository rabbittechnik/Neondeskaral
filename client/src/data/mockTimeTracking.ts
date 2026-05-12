import type { ShiftCloseChecklist, TimeEntry } from '../types/timeTracking'
import { STATION } from './station'
import { toISODateLocal } from '../utils/taskUtils'

export function localAtDate(isoDate: string, h: number, min: number): string {
  const [y, mo, d] = isoDate.split('-').map(Number)
  const dt = new Date(y!, mo! - 1, d!, h, min, 0, 0)
  return dt.toISOString()
}

export function buildSeedTimeEntries(): TimeEntry[] {
  const today = toISODateLocal(new Date())
  const y = new Date()
  y.setDate(y.getDate() - 1)
  const yesterday = toISODateLocal(y)
  const now = new Date().toISOString()

  const entries: TimeEntry[] = [
    {
      id: 'te-run-1',
      employeeId: 'e3',
      stationId: STATION.id,
      startAt: localAtDate(today, 5, 32),
      breakMinutes: 0,
      status: 'running',
      source: 'cash_register_card_terminal',
      startedBy: 'Terminal',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'te-run-2',
      employeeId: 'e2',
      stationId: STATION.id,
      startAt: localAtDate(today, 5, 29),
      breakMinutes: 0,
      status: 'running',
      source: 'cash_register_card_terminal',
      startedBy: 'Terminal',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'te-done-luca',
      employeeId: 'e7',
      stationId: STATION.id,
      startAt: localAtDate(yesterday, 14, 2),
      endAt: localAtDate(yesterday, 21, 16),
      breakMinutes: 30,
      status: 'completed',
      source: 'cash_register_card_terminal',
      startedBy: 'Terminal',
      endedBy: 'Terminal',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'te-night-enise',
      employeeId: 'e5',
      stationId: STATION.id,
      startAt: localAtDate(yesterday, 22, 0),
      endAt: localAtDate(today, 6, 1),
      breakMinutes: 45,
      status: 'completed',
      source: 'manual',
      startedBy: 'Terminal',
      endedBy: 'Terminal',
      createdAt: now,
      updatedAt: now,
    },
  ]
  return entries
}

export function buildSeedChecklists(): ShiftCloseChecklist[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'chk-luca',
      timeEntryId: 'te-done-luca',
      employeeId: 'e7',
      fridgeFronted: true,
      drinksFilled: true,
      cigarettesFilled: true,
      shelvesFilled: true,
      trashEmptied: true,
      counterClean: true,
      coffeeAreaClean: true,
      outsideChecked: true,
      incidentsNoted: true,
      handoverPossible: true,
      closingReady: true,
      everythingOk: true,
      incidentNote: '',
      completedAt: now,
    },
  ]
}

export function cloneSeedTimeEntries(): TimeEntry[] {
  return structuredClone(buildSeedTimeEntries())
}

export function cloneSeedChecklists(): ShiftCloseChecklist[] {
  return structuredClone(buildSeedChecklists())
}

export function createTimeEntryId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `tent-${crypto.randomUUID()}`
  return `tent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createChecklistId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `chk-${crypto.randomUUID()}`
  return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createCardEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `cev-${crypto.randomUUID()}`
  return `cev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
