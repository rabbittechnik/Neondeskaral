import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ClipboardList, Plane, UserX } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { useTasks } from '../../context/tasks-context'
import { countOpenTasks, countOverdueTasks, getTaskStatusForDate, toISODateLocal } from '../../utils/taskUtils'

function OpenTasksStat() {
  const { tasks, logs } = useTasks()
  const date = toISODateLocal(new Date())
  const now = new Date()
  const open = countOpenTasks(tasks, logs, date, now)
  const overdue = countOverdueTasks(tasks, logs, date, now)
  const top = useMemo(() => {
    const prOrder: Record<string, number> = { kritisch: 4, hoch: 3, normal: 2, niedrig: 1 }
    return tasks
      .filter((t) => t.active)
      .map((t) => ({ t, st: getTaskStatusForDate(t, logs, date, now) }))
      .sort((a, b) => {
        const ov = (s: string | null) => (s === 'überfällig' ? 3 : s === 'offen' || s === 'in_kontrolle' ? 2 : 0)
        const d = ov(b.st) - ov(a.st)
        if (d !== 0) return d
        return (prOrder[b.t.priority] ?? 0) - (prOrder[a.t.priority] ?? 0)
      })
      .slice(0, 5)
      .map((x) => x.t)
  }, [tasks, logs, date, now])

  return (
    <StatCard
      title="Offene Aufgaben"
      value={String(open)}
      hint={
        <div className="space-y-2">
          {overdue > 0 ? <p className="text-red-300">{overdue} überfällig</p> : <p>Keine Überfälligen</p>}
          <ul className="max-h-24 space-y-1 overflow-hidden text-[11px] text-[var(--text-muted)]">
            {top.map((t) => (
              <li key={t.id} className="truncate">
                · {t.title}
              </li>
            ))}
          </ul>
            <Link
              to="/tasks"
              className="inline-flex items-center rounded-md border border-cyan-400/35 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/10"
            >
              Aufgaben öffnen
            </Link>
            <Link
              to="/tasks"
              className="inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-white/5"
            >
              Neue Aufgabe
            </Link>
        </div>
      }
      icon={<ClipboardList className="h-5 w-5 text-lime-200" />}
      accentClass="neon-border-lime"
    />
  )
}

export function DashboardStats() {
  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <StatCard
        title="Heute im Dienst"
        value="7 von 11 geplant"
        icon={<CalendarClock className="h-5 w-5 text-cyan-200" />}
        accentClass="neon-border-cyan"
      />
      <OpenTasksStat />
      <StatCard
        title="Abwesenheiten"
        value="3 heute"
        icon={<Plane className="h-5 w-5 text-pink-200" />}
        accentClass="neon-border-pink"
      />
      <StatCard
        title="Offene Schichten"
        value="2 diese Woche"
        icon={<UserX className="h-5 w-5 text-amber-200" />}
        accentClass="neon-border-amber"
      />
    </div>
  )
}
