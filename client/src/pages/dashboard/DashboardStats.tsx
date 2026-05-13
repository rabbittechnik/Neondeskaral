import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, ClipboardList, Plane, UserRound } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { useTasks } from '../../context/tasks-context'
import { countOpenTasks, countOverdueTasks, getTaskStatusForDate, toISODateLocal } from '../../utils/taskUtils'
import { DashboardOpenShiftsDetailModal } from './DashboardOpenShiftsDetailModal'
import { useDashboardLiveStats } from './useDashboardLiveStats'

function OpenTasksStatCompact() {
  const { tasks, logs, loading, error } = useTasks()
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
      .slice(0, 3)
      .map((x) => x.t)
  }, [tasks, logs, date, now])

  const valueNode = error ? (
    <span className="text-lg text-rose-300">—</span>
  ) : loading ? (
    <span className="text-lg text-[var(--text-muted)]">…</span>
  ) : (
    String(open)
  )

  const compactFooter = error ? (
    <p className="text-rose-300/90">{error}</p>
  ) : loading ? (
    <p className="text-[var(--text-muted)]">Aufgaben werden geladen…</p>
  ) : open === 0 && top.length === 0 ? (
    <p className="text-[var(--text-muted)]">Keine offenen Aufgaben.</p>
  ) : (
    <div className="space-y-1.5">
      <p className={overdue > 0 ? 'text-red-300/95' : 'text-emerald-200/85'}>
        {overdue > 0 ? `${overdue} überfällig` : 'Keine Überfälligen'}
      </p>
      {top.length > 0 ? (
        <ul className="max-h-[3.25rem] space-y-0.5 overflow-y-auto text-[10px] leading-snug text-[var(--text-muted)]">
          {top.map((t) => (
            <li key={t.id} className="truncate">
              · {t.title}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <Link
          to="/tasks"
          className="inline-flex items-center rounded border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 hover:bg-cyan-500/20"
        >
          Aufgaben öffnen
        </Link>
        <Link
          to="/tasks"
          className="inline-flex items-center rounded border border-white/12 px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-white/5"
        >
          Neue Aufgabe
        </Link>
      </div>
    </div>
  )

  return (
    <StatCard
      title="Offene Aufgaben"
      value={valueNode}
      density="compact"
      compactFooter={compactFooter}
      className="min-h-0"
      icon={<ClipboardList className="h-[18px] w-[18px] text-lime-200" />}
      accentClass="neon-border-lime"
    />
  )
}

function OffeneSchichtenIcon() {
  return (
    <div className="relative flex h-9 w-9 items-center justify-center">
      <UserRound className="h-5 w-5 text-amber-200" aria-hidden />
      <AlertTriangle className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" aria-hidden />
    </div>
  )
}

export function DashboardStats() {
  const { totalToday, filledToday, openThisWeek, openShiftsWeek, approvedAwayToday, loading, shiftError, absencesError, reload } =
    useDashboardLiveStats()
  const [openShiftsModal, setOpenShiftsModal] = useState(false)

  const dataError = shiftError || absencesError

  const dienstValue =
    loading && !dataError ? (
      '…'
    ) : shiftError ? (
      '—'
    ) : totalToday === 0 ? (
      '0 von 0'
    ) : (
      `${filledToday} von ${totalToday}`
    )

  const abwValue =
    loading && !absencesError ? '…' : absencesError ? '—' : String(approvedAwayToday)

  const offenValue = loading && !shiftError ? '…' : shiftError ? '—' : String(openThisWeek)

  const offenFooter = useMemo(() => {
    if (shiftError) return null
    return (
      <div className="space-y-0.5">
        <p className="text-[var(--text-faint)]">diese Woche</p>
        {!loading && openShiftsWeek.totalCount === 0 ? (
          <p className="text-emerald-200/80">Keine offenen Schichten</p>
        ) : !loading && openShiftsWeek.summaryLine ? (
          <p className="text-amber-200/90">{openShiftsWeek.summaryLine}</p>
        ) : !loading && openThisWeek > 0 ? (
          <p className="text-[var(--text-muted)]">inkl. offene Datensätze</p>
        ) : null}
      </div>
    )
  }, [loading, openShiftsWeek, openThisWeek, shiftError])

  return (
    <div className="space-y-2">
      <DashboardOpenShiftsDetailModal
        open={openShiftsModal}
        onClose={() => setOpenShiftsModal(false)}
        summary={openShiftsWeek}
      />
      {dataError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <p className="font-medium">Dashboard-Daten konnten nicht vollständig geladen werden.</p>
          <p className="mt-1 text-xs text-rose-200/90">{dataError}</p>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-cyan-200 underline"
            onClick={() => void reload()}
          >
            Erneut versuchen
          </button>
        </div>
      ) : null}
      <div className="grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
        <StatCard
          density="compact"
          title="Heute im Dienst"
          value={dienstValue}
          icon={<CalendarClock className="h-[18px] w-[18px] text-cyan-200" />}
          accentClass="neon-border-cyan"
        />
        <StatCard
          density="compact"
          title="Abwesenheiten"
          value={abwValue}
          icon={<Plane className="h-[18px] w-[18px] text-pink-200" />}
          accentClass="neon-border-pink"
        />
        <StatCard
          density="compact"
          title="Offene Schichten"
          value={offenValue}
          compactFooter={offenFooter}
          onClick={shiftError || loading ? undefined : () => setOpenShiftsModal(true)}
          icon={<OffeneSchichtenIcon />}
          accentClass="neon-border-amber"
        />
        <OpenTasksStatCompact />
      </div>
      {!loading && !shiftError && totalToday === 0 ? (
        <p className="text-center text-xs text-[var(--text-faint)]">Heute keine Schichten geplant.</p>
      ) : null}
    </div>
  )
}
