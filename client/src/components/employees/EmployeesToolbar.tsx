import { Download, LayoutGrid, Table2 } from 'lucide-react'
import type { EmployeeHRStatus, EmploymentType } from '../../types/employee'
import { useWorkAreas } from '../../context/work-areas-context'
import { Button } from '../ui/Button'
import { EMPLOYMENT_LABELS, STATUS_LABELS } from './employeeLabels'

export type ViewMode = 'cards' | 'table'

type Props = {
  search: string
  onSearch: (v: string) => void
  employment: EmploymentType | 'all'
  onEmployment: (v: EmploymentType | 'all') => void
  status: EmployeeHRStatus | 'all'
  onStatus: (v: EmployeeHRStatus | 'all') => void
  workAreaId: string | 'all'
  onWorkArea: (v: string | 'all') => void
  viewMode: ViewMode
  onViewMode: (v: ViewMode) => void
  onExport: () => void
  showInactiveEmployees?: boolean
  onShowInactiveEmployees?: (v: boolean) => void
  showDeletedEmployees?: boolean
  onShowDeletedEmployees?: (v: boolean) => void
  canViewDeletedEmployees?: boolean
}

export function EmployeesToolbar({
  search,
  onSearch,
  employment,
  onEmployment,
  status,
  onStatus,
  workAreaId,
  onWorkArea,
  viewMode,
  onViewMode,
  onExport,
  showInactiveEmployees = false,
  onShowInactiveEmployees,
  showDeletedEmployees = false,
  onShowDeletedEmployees,
  canViewDeletedEmployees = false,
}: Props) {
  const { definitions: workAreaDefinitions } = useWorkAreas()
  const select =
    'h-10 min-w-[140px] rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/15'

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/70 p-3 backdrop-blur-sm lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
        <label htmlFor="emp-search" className="sr-only">
          Suche
        </label>
        <input
          id="emp-search"
          type="search"
          placeholder="Mitarbeiter suchen…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/15"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={select}
          aria-label="Beschäftigungsart"
          value={employment}
          onChange={(e) => onEmployment(e.target.value as EmploymentType | 'all')}
        >
          <option value="all">Alle Beschäftigungsarten</option>
          {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((k) => (
            <option key={k} value={k}>
              {EMPLOYMENT_LABELS[k]}
            </option>
          ))}
        </select>

        <select
          className={select}
          aria-label="Status"
          value={status}
          onChange={(e) => onStatus(e.target.value as EmployeeHRStatus | 'all')}
        >
          <option value="all">Alle Status</option>
          {(Object.keys(STATUS_LABELS) as EmployeeHRStatus[]).map((k) => (
            <option key={k} value={k}>
              {STATUS_LABELS[k]}
            </option>
          ))}
        </select>

        <select
          className={`${select} min-w-[180px]`}
          aria-label="Arbeitsbereich"
          value={workAreaId}
          onChange={(e) => onWorkArea(e.target.value as string | 'all')}
        >
          <option value="all">Alle Arbeitsbereiche</option>
          {workAreaDefinitions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            className="rounded border-[var(--border-strong)] text-cyan-500 focus:ring-cyan-400/30"
            checked={showInactiveEmployees}
            onChange={(e) => onShowInactiveEmployees?.(e.target.checked)}
          />
          Deaktivierte anzeigen
        </label>

        {canViewDeletedEmployees ? (
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              className="rounded border-[var(--border-strong)] text-cyan-500 focus:ring-cyan-400/30"
              checked={showDeletedEmployees}
              onChange={(e) => onShowDeletedEmployees?.(e.target.checked)}
            />
            Archiv (gelöschte) anzeigen
          </label>
        ) : null}

        <Button variant="outline" className="px-3 py-2" onClick={onExport} leftIcon={<Download className="h-4 w-4" />}>
          Export
        </Button>

        <div className="flex rounded-[var(--radius-sm)] border border-[var(--border-strong)] p-0.5">
          <button
            type="button"
            title="Karten"
            onClick={() => onViewMode('cards')}
            className={`rounded-[6px] p-2 transition ${
              viewMode === 'cards'
                ? 'bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tabelle"
            onClick={() => onViewMode('table')}
            className={`rounded-[6px] p-2 transition ${
              viewMode === 'table'
                ? 'bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
