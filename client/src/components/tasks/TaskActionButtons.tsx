import { CheckCircle2, Eye, Pencil, Power, PowerOff, ShieldCheck, Trash2 } from 'lucide-react'
import type { Task, TaskStatus } from '../../types/task'
import { Button } from '../ui/Button'

type Props = {
  task: Task
  status: TaskStatus | null
  onView: () => void
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
  onConfirm: () => void
  onControl: () => void
}

export function TaskActionButtons({
  task,
  status,
  onView,
  onEdit,
  onToggleActive,
  onDelete,
  onConfirm,
  onControl,
}: Props) {
  const canConfirm =
    task.active &&
    task.confirmRequired &&
    status !== null &&
    (status === 'offen' || status === 'überfällig')
  const canControl =
    task.active && task.controlRequired && status === 'in_kontrolle'

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={onView} leftIcon={<Eye className="h-3.5 w-3.5" />}>
        Anzeigen
      </Button>
      <Button
        variant="ghost"
        className="!px-2 !py-1 text-xs"
        onClick={onEdit}
        disabled={!task.active}
        leftIcon={<Pencil className="h-3.5 w-3.5" />}
      >
        Bearbeiten
      </Button>
      {task.active ? (
        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={onToggleActive} leftIcon={<PowerOff className="h-3.5 w-3.5" />}>
          Deaktivieren
        </Button>
      ) : (
        <Button variant="ghost" className="!px-2 !py-1 text-xs text-emerald-300" onClick={onToggleActive} leftIcon={<Power className="h-3.5 w-3.5" />}>
          Aktivieren
        </Button>
      )}
      <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-300" onClick={onDelete} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
        Löschen
      </Button>
      {canConfirm ? (
        <Button variant="outline" className="!px-2 !py-1 text-xs" onClick={onConfirm} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>
          Bestätigen
        </Button>
      ) : null}
      {canControl ? (
        <Button variant="primary" className="!px-2 !py-1 text-xs" onClick={onControl} leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}>
          Kontrollieren
        </Button>
      ) : null}
    </div>
  )
}
