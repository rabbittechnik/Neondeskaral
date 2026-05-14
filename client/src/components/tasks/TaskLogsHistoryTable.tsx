import { useMemo } from 'react'
import type { Employee } from '../../types/employee'
import type { Task, TaskLog } from '../../types/task'

type Props = {
  logs: TaskLog[]
  tasks: Task[]
  employees: Employee[]
}

export function TaskLogsHistoryTable({ logs, tasks, employees }: Props) {
  const taskTitle = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tasks) m.set(t.id, t.title)
    return m
  }, [tasks])

  const sorted = useMemo(
    () =>
      [...logs].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return a.id < b.id ? 1 : -1
      }),
    [logs],
  )

  const empName = (id?: string) => {
    if (!id) return '—'
    return employees.find((e) => e.id === id)?.displayName ?? id
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <tr>
            <th className="px-3 py-2">Datum</th>
            <th className="px-3 py-2">Aufgabe</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Mitarbeiter</th>
            <th className="px-3 py-2">Erledigt / Kontrolle</th>
            <th className="px-3 py-2">Kommentar</th>
            <th className="px-3 py-2">Nicht erledigt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sorted.map((l) => (
            <tr key={l.id} className="hover:bg-white/5">
              <td className="px-3 py-2 whitespace-nowrap text-[var(--text-main)]">{l.date}</td>
              <td className="px-3 py-2 text-[var(--text-main)]">{taskTitle.get(l.taskId) ?? l.taskId}</td>
              <td className="px-3 py-2 text-[var(--text-muted)]">{l.status}</td>
              <td className="px-3 py-2 text-[var(--text-muted)]">{empName(l.confirmedBy)}</td>
              <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                {l.confirmedAt ? l.confirmedAt.slice(0, 16).replace('T', ' ') : '—'}
                {l.controlledAt ? ` · K: ${l.controlledAt.slice(0, 16).replace('T', ' ')}` : ''}
              </td>
              <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{l.comment ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-amber-200/90">{l.notDoneReason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 ? <p className="p-4 text-sm text-[var(--text-muted)]">Noch keine Einträge für diese Station.</p> : null}
    </div>
  )
}
