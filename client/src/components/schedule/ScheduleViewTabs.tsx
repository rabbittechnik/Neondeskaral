import { CalendarDays, Printer, Users } from 'lucide-react'

export type ScheduleViewMode = 'calendar' | 'employee' | 'print'

type Props = {
  active: ScheduleViewMode
  onChange: (v: ScheduleViewMode) => void
}

const tabs: { id: ScheduleViewMode; label: string; icon: typeof CalendarDays }[] = [
  { id: 'calendar', label: 'Kalenderansicht', icon: CalendarDays },
  { id: 'employee', label: 'Mitarbeiteransicht', icon: Users },
  { id: 'print', label: 'Druckansicht', icon: Printer },
]

export function ScheduleViewTabs({ active, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-1"
      role="tablist"
      aria-label="Schichtplan-Ansicht"
    >
      {tabs.map((t) => {
        const Icon = t.icon
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] shadow-[var(--glow-cyan)] ring-1 ring-cyan-400/40'
                : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(' ')[0]}</span>
          </button>
        )
      })}
    </div>
  )
}
