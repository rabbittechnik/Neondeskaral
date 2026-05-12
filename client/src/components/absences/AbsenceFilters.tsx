import { useState } from 'react'
import type { Absence, AbsenceType, AbsenceStatus } from '../../types/absence'
import type { Employee } from '../../types/employee'
import { WORK_AREA_DEFINITIONS } from '../../data/mockEmployees'
import { ABSENCE_TYPE_LABELS, ABSENCE_STATUS_LABELS } from './absenceLabels'

export type ListFilters = {
  q: string
  type: AbsenceType | 'all'
  status: AbsenceStatus | 'all'
  workAreaId: string | 'all'
  dateFrom: string
  dateTo: string
  openOnly: boolean
}

const initialFilters: ListFilters = {
  q: '',
  type: 'all',
  status: 'all',
  workAreaId: 'all',
  dateFrom: '',
  dateTo: '',
  openOnly: false,
}

type Props = {
  value: ListFilters
  onChange: (v: ListFilters) => void
}

export function AbsenceFilters({ value, onChange }: Props) {
  const patch = (p: Partial<ListFilters>) => onChange({ ...value, ...p })

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-3 md:flex-row md:flex-wrap md:items-end">
      <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-[var(--text-muted)]">
        Suche Mitarbeiter
        <input
          type="search"
          value={value.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Name …"
          className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)]"
        />
      </label>
      <label className="flex min-w-[120px] flex-col gap-1 text-xs text-[var(--text-muted)]">
        Typ
        <select
          value={value.type}
          onChange={(e) => patch({ type: e.target.value as ListFilters['type'] })}
          className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)]"
        >
          <option value="all">Alle</option>
          {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((t) => (
            <option key={t} value={t}>
              {ABSENCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[120px] flex-col gap-1 text-xs text-[var(--text-muted)]">
        Status
        <select
          value={value.status}
          onChange={(e) => patch({ status: e.target.value as ListFilters['status'] })}
          className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)]"
        >
          <option value="all">Alle</option>
          {(Object.keys(ABSENCE_STATUS_LABELS) as AbsenceStatus[]).map((s) => (
            <option key={s} value={s}>
              {ABSENCE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[120px] flex-col gap-1 text-xs text-[var(--text-muted)]">
        Arbeitsbereich
        <select
          value={value.workAreaId}
          onChange={(e) => patch({ workAreaId: e.target.value as ListFilters['workAreaId'] })}
          className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)]"
        >
          <option value="all">Alle</option>
          {WORK_AREA_DEFINITIONS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[130px] flex-col gap-1 text-xs text-[var(--text-muted)]">
        Von
        <input
          type="date"
          value={value.dateFrom}
          onChange={(e) => patch({ dateFrom: e.target.value })}
          className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)]"
        />
      </label>
      <label className="flex min-w-[130px] flex-col gap-1 text-xs text-[var(--text-muted)]">
        Bis
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) => patch({ dateTo: e.target.value })}
          className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-main)]"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
        <input
          type="checkbox"
          checked={value.openOnly}
          onChange={(e) => patch({ openOnly: e.target.checked })}
          className="rounded border-[var(--border-subtle)]"
        />
        Nur offene Anträge
      </label>
      <button
        type="button"
        onClick={() => onChange({ ...initialFilters })}
        className="rounded-[var(--radius-sm)] border border-white/15 px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-white/5"
      >
        Filter zurücksetzen
      </button>
    </div>
  )
}

export function useListFiltersState() {
  return useState<ListFilters>(initialFilters)
}

export function filterAbsencesList(absences: Absence[], employees: Employee[], f: ListFilters): Absence[] {
  const needle = f.q.trim().toLowerCase()
  return absences.filter((a) => {
    if (f.openOnly && a.status !== 'beantragt') return false
    if (f.type !== 'all' && a.type !== f.type) return false
    if (f.status !== 'all' && a.status !== f.status) return false
    if (f.dateFrom && a.endDate < f.dateFrom) return false
    if (f.dateTo && a.startDate > f.dateTo) return false
    const emp = employees.find((e) => e.id === a.employeeId)
    if (f.workAreaId !== 'all' && emp && !emp.workAreaIds.includes(f.workAreaId)) return false
    if (needle) {
      const blob = `${emp?.displayName ?? ''} ${a.comment}`.toLowerCase()
      if (!blob.includes(needle)) return false
    }
    return true
  })
}
