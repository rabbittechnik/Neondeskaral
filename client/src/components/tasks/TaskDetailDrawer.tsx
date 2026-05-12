import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Task, TaskLog } from '../../types/task'
import type { Employee } from '../../types/employee'
import { getWorkAreaById } from '../../data/mockEmployees'
import { formatTaskAssigned, recurrenceSummary, shiftHintLabel } from '../../utils/taskUtils'
import { Badge } from '../ui/Badge'
import { TaskHistoryList } from './TaskHistoryList'
import { TaskPriorityBadge } from './TaskPriorityBadge'

type Tab = 'overview' | 'history' | 'controls' | 'settings'

type Props = {
  open: boolean
  task: Task | null
  logs: TaskLog[]
  employees: Employee[]
  onClose: () => void
}

export function TaskDetailDrawer({ open, task, logs, employees, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    if (open) setTab('overview')
  }, [open, task?.id])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open || !task) return null

  const area = getWorkAreaById(task.workAreaId)
  const taskLogs = logs.filter((l) => l.taskId === task.id).sort((a, b) => (a.date < b.date ? 1 : -1))
  const controlLogs = taskLogs.filter((l) => l.controlledAt)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'history', label: 'Historie' },
    { id: 'controls', label: 'Kontrollen' },
    { id: 'settings', label: 'Einstellungen' },
  ]

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[-12px_0_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">{task.title}</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{area?.name ?? task.workAreaId}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-2 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === t.id
                  ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40'
                  : 'text-[var(--text-muted)] hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {tab === 'overview' ? (
            <div className="space-y-3 text-[var(--text-muted)]">
              <p>{task.description}</p>
              <p>
                <span className="text-[var(--text-faint)]">Arbeitsbereich: </span>
                {area?.name}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Wiederholung: </span>
                {recurrenceSummary(task)}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Zeitfenster: </span>
                {task.startTime} – {task.endTime}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Zuständig: </span>
                {formatTaskAssigned(task, employees)}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Pflicht: </span>
                {task.mandatory ? 'Ja' : 'Nein'}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Bestätigung: </span>
                {task.confirmRequired ? 'Ja' : 'Nein'}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Kontrolle: </span>
                {task.controlRequired ? 'Ja' : 'Nein'}
              </p>
              {shiftHintLabel(task.shiftHint) ? (
                <p className="text-violet-200/90">{shiftHintLabel(task.shiftHint)}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <TaskPriorityBadge priority={task.priority} />
                {task.active ? <Badge tone="success">Aktiv</Badge> : <Badge tone="default">Deaktiviert</Badge>}
              </div>
            </div>
          ) : null}
          {tab === 'history' ? <TaskHistoryList logs={taskLogs} /> : null}
          {tab === 'controls' ? <TaskHistoryList logs={controlLogs} /> : null}
          {tab === 'settings' ? (
            <ul className="space-y-2 text-xs text-[var(--text-muted)]">
              <li>Startdatum: {task.startDate}</li>
              <li>Enddatum: {task.endDate ?? '—'}</li>
              <li>Erstellt: {task.createdAt.slice(0, 10)} von {task.createdBy}</li>
              <li>Aktualisiert: {task.updatedAt.slice(0, 16).replace('T', ' ')}</li>
              {task.note ? <li>Notiz: {task.note}</li> : null}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
