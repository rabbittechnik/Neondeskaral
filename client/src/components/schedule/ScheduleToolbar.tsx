import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Printer,
  Send,
} from 'lucide-react'
import type { ScheduleEmployeeRow } from '../../types/employee'
import { useWorkAreas } from '../../context/work-areas-context'
import { Button } from '../ui/Button'
import { ScheduleAssistantButton } from './assistant/ScheduleAssistantButton'

const selectClass =
  'h-10 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-main)] focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/20'

type Props = {
  workAreaFilter: string
  onWorkAreaFilter: (v: string) => void
  employeeFilter: string
  onEmployeeFilter: (v: string) => void
  onToday: () => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onNewShift: () => void
  onPublish: () => void
  onPrint: () => void
  onMore: () => void
  scheduleEmployees: ScheduleEmployeeRow[]
  onOpenAssistant?: () => void
}

export function ScheduleToolbar({
  workAreaFilter,
  onWorkAreaFilter,
  employeeFilter,
  onEmployeeFilter,
  onToday,
  onPrevWeek,
  onNextWeek,
  onNewShift,
  onPublish,
  onPrint,
  onMore,
  scheduleEmployees,
  onOpenAssistant,
}: Props) {
  const { workAreas, loading: areasLoading, error: areasError } = useWorkAreas()
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-3 backdrop-blur-sm md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="px-3 py-2" onClick={onToday}>
          <Calendar className="h-4 w-4" aria-hidden />
          Heute
        </Button>
        <Button variant="ghost" className="px-2 py-2" onClick={onPrevWeek} aria-label="Vorherige Woche">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" className="px-2 py-2" onClick={onNextWeek} aria-label="Nächste Woche">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {areasError ? (
          <span className="text-xs text-amber-300/90" title={areasError}>
            Arbeitsbereiche: Offline
          </span>
        ) : null}
        <select
          className={`${selectClass} min-w-[180px]`}
          value={workAreaFilter}
          onChange={(e) => onWorkAreaFilter(e.target.value)}
          aria-label="Arbeitsbereich"
          disabled={areasLoading}
        >
          <option value="all">{areasLoading ? 'Lade Bereiche…' : 'Alle Arbeitsbereiche'}</option>
          {workAreas.map((w) => (
            <option key={w.id} value={w.shortCode}>
              {w.shortCode} · {w.label}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} min-w-[200px]`}
          value={employeeFilter}
          onChange={(e) => onEmployeeFilter(e.target.value)}
          aria-label="Mitarbeiter"
        >
          <option value="all">Alle Mitarbeiter</option>
          {scheduleEmployees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {onOpenAssistant ? <ScheduleAssistantButton onClick={onOpenAssistant} /> : null}
        <Button variant="primary" className="px-3 py-2" onClick={onNewShift} leftIcon={<Plus className="h-4 w-4" />}>
          Neue Schicht
        </Button>
        <Button variant="outline" className="px-3 py-2" onClick={onPublish} leftIcon={<Send className="h-4 w-4" />}>
          Plan veröffentlichen
        </Button>
        <Button variant="outline" className="px-3 py-2" onClick={onPrint} leftIcon={<Printer className="h-4 w-4" />}>
          Druckansicht
        </Button>
        <Button variant="ghost" className="px-3 py-2" onClick={onMore} aria-label="Mehr">
          <MoreHorizontal className="h-5 w-5" />
          <span className="hidden sm:inline">Mehr</span>
        </Button>
      </div>
    </div>
  )
}
