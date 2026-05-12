import type { Task } from '../../types/task'
import type { TaskRecurrenceTab } from './filterTasks'

type Props = {
  tasks: Task[]
  value: TaskRecurrenceTab
  onChange: (v: TaskRecurrenceTab) => void
}

const TABS: { id: TaskRecurrenceTab; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'once', label: 'Einmalig' },
  { id: 'daily', label: 'Täglich' },
  { id: 'weekly', label: 'Wöchentlich' },
  { id: 'monthly', label: 'Monatlich' },
]

export function TaskTabs({ tasks, value, onChange }: Props) {
  const count = (id: TaskRecurrenceTab) =>
    id === 'all' ? tasks.length : tasks.filter((t) => t.recurrenceType === id).length

  return (
    <div
      className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-1"
      role="tablist"
      aria-label="Intervall"
    >
      {TABS.map((tab) => {
        const active = value === tab.id
        const n = count(tab.id)
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] shadow-[var(--glow-cyan)] ring-1 ring-cyan-400/40'
                : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                active ? 'bg-cyan-500/25 text-cyan-100' : 'bg-white/5 text-[var(--text-faint)]'
              }`}
            >
              {n}
            </span>
          </button>
        )
      })}
    </div>
  )
}
