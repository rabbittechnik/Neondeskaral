import { LayoutGrid, Plus, Search } from 'lucide-react'
import type { Employee } from '../../types/employee'
import type { WorkAreaDefinition } from '../../types/employee'
import type { TaskRecurrence } from '../../types/task'
import type { TaskRecurrenceTab, TaskStatusFilter } from './filterTasks'
import { TASK_RECURRENCE_LABELS } from './taskLabels'
import { Button } from '../ui/Button'

type Props = {
  search: string
  onSearch: (v: string) => void
  workAreaId: string
  onWorkArea: (v: string) => void
  workAreas: WorkAreaDefinition[]
  status: TaskStatusFilter
  onStatus: (v: TaskStatusFilter) => void
  recurrence: TaskRecurrenceTab
  onRecurrence: (v: TaskRecurrenceTab) => void
  assignee: string
  onAssignee: (v: string) => void
  employees: Employee[]
  onCreate: () => void
  onPlan?: () => void
  onExport?: () => void
  onPrint?: () => void
}

export function TasksToolbar({
  search,
  onSearch,
  workAreaId,
  onWorkArea,
  workAreas,
  status,
  onStatus,
  recurrence,
  onRecurrence,
  assignee,
  onAssignee,
  employees,
  onCreate,
  onPlan,
  onExport,
  onPrint,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="block min-w-[180px] flex-1 text-xs text-[var(--text-muted)]">
          Arbeitsbereich
          <select
            value={workAreaId}
            onChange={(e) => onWorkArea(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            <option value="">Alle Arbeitsbereiche</option>
            {workAreas.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[220px] flex-[2] text-xs text-[var(--text-muted)]">
          Aufgaben suchen…
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Titel, Beschreibung …"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-2 pl-9 pr-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
            />
          </span>
        </label>
        <Button variant="primary" type="button" className="lg:ml-auto" onClick={onCreate} leftIcon={<Plus className="h-4 w-4" />}>
          Aufgabe erstellen
        </Button>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <label className="block min-w-[160px] flex-1 text-xs text-[var(--text-muted)]">
          Status
          <select
            value={status}
            onChange={(e) => onStatus(e.target.value as TaskStatusFilter)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            <option value="all">Alle</option>
            <option value="aktiv">Aktiv</option>
            <option value="deaktiviert">Deaktiviert</option>
            <option value="offen">Offen</option>
            <option value="erledigt">Erledigt</option>
            <option value="überfällig">Überfällig</option>
            <option value="in_kontrolle">In Kontrolle</option>
            <option value="kontrolliert">Kontrolliert</option>
            <option value="mangel">Mangel</option>
          </select>
        </label>
        <label className="block min-w-[160px] flex-1 text-xs text-[var(--text-muted)]">
          Intervall
          <select
            value={recurrence}
            onChange={(e) => onRecurrence(e.target.value as TaskRecurrenceTab)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            <option value="all">Alle</option>
            {(Object.keys(TASK_RECURRENCE_LABELS) as TaskRecurrence[]).map((r) => (
              <option key={r} value={r}>
                {TASK_RECURRENCE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[200px] flex-1 text-xs text-[var(--text-muted)]">
          Verantwortlich
          <select
            value={assignee}
            onChange={(e) => onAssignee(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            <option value="all">Alle</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          {onPlan ? (
            <Button variant="outline" type="button" onClick={onPlan} leftIcon={<LayoutGrid className="h-4 w-4" />}>
              Aufgabenplan
            </Button>
          ) : null}
          {onExport ? (
            <Button variant="ghost" type="button" onClick={onExport}>
              Export
            </Button>
          ) : null}
          {onPrint ? (
            <Button variant="ghost" type="button" onClick={onPrint}>
              Druckansicht
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
