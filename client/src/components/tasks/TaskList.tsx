import { LayoutGrid, Table2 } from 'lucide-react'
import type { Task, TaskLog } from '../../types/task'
import type { Employee } from '../../types/employee'
import { Button } from '../ui/Button'
import { TaskTable } from './TaskTable'
import { TaskCard } from './TaskCard'

type Layout = 'table' | 'cards'

type Props = {
  tasks: Task[]
  logs: TaskLog[]
  employees: Employee[]
  refDate: string
  layout: Layout
  onLayout: (l: Layout) => void
  onView: (t: Task) => void
  onEdit: (t: Task) => void
  onToggleActive: (t: Task) => void
  onDelete: (t: Task) => void
  onConfirm: (t: Task) => void
  onControl: (t: Task) => void
}

export function TaskList({
  tasks,
  logs,
  employees,
  refDate,
  layout,
  onLayout,
  onView,
  onEdit,
  onToggleActive,
  onDelete,
  onConfirm,
  onControl,
}: Props) {
  const common = {
    logs,
    employees,
    refDate,
    onView,
    onEdit,
    onToggleActive,
    onDelete,
    onConfirm,
    onControl,
  }

  if (tasks.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-dashed border-white/10 py-12 text-center text-sm text-[var(--text-faint)]">
        Keine Aufgaben für die aktuellen Filter.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          variant={layout === 'table' ? 'primary' : 'ghost'}
          type="button"
          className="!px-2 !py-1 text-xs"
          onClick={() => onLayout('table')}
          leftIcon={<Table2 className="h-3.5 w-3.5" />}
        >
          Tabelle
        </Button>
        <Button
          variant={layout === 'cards' ? 'primary' : 'ghost'}
          type="button"
          className="!px-2 !py-1 text-xs"
          onClick={() => onLayout('cards')}
          leftIcon={<LayoutGrid className="h-3.5 w-3.5" />}
        >
          Karten
        </Button>
      </div>

      <div className={layout === 'table' ? 'hidden md:block' : 'hidden'}>
        <TaskTable tasks={tasks} {...common} />
      </div>

      <div
        className={
          layout === 'cards'
            ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
            : 'grid gap-3 md:hidden'
        }
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} {...common} />
        ))}
      </div>
    </div>
  )
}
