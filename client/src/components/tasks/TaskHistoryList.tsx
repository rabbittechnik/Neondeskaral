import type { TaskLog, TaskStatus } from '../../types/task'
import { TASK_STATUS_LABELS, CONTROL_RESULT_LABELS } from './taskLabels'

type Props = {
  logs: TaskLog[]
}

export function TaskHistoryList({ logs }: Props) {
  if (logs.length === 0) {
    return <p className="text-sm text-[var(--text-faint)]">Noch keine Einträge.</p>
  }
  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li
          key={l.id}
          className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-black/20 px-3 py-2 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-[var(--text-main)]">{l.date}</span>
            <span className="text-xs text-[var(--text-muted)]">{TASK_STATUS_LABELS[l.status as TaskStatus]}</span>
          </div>
          {l.confirmedAt ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Bestätigt von {l.confirmedBy ?? '—'} · {l.confirmedAt.slice(0, 16).replace('T', ' ')}
            </p>
          ) : null}
          {l.controlledAt ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Kontrolle von {l.controlledBy ?? '—'} · {l.controlledAt.slice(0, 16).replace('T', ' ')}
              {l.controlResult ? ` · ${CONTROL_RESULT_LABELS[l.controlResult]}` : ''}
            </p>
          ) : null}
          {l.comment ? <p className="mt-1 text-xs text-[var(--text-faint)]">„{l.comment}“</p> : null}
        </li>
      ))}
    </ul>
  )
}
