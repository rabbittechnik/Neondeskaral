import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, ClipboardList, Plane, UserRound } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { useStation } from '../../context/station-context'
import type { Task, TaskLog } from '../../types/task'
import { apiGet } from '../../services/api'
import { countOpenTasks, countOverdueTasks, toISODateLocal } from '../../utils/taskUtils'
import { DashboardOpenShiftsDetailModal } from './DashboardOpenShiftsDetailModal'
import { useDashboardLiveStats } from './useDashboardLiveStats'

function OpenTasksStatCompact() {
  const { stationId } = useStation()
  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId) {
      setTasks([])
      setLogs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [tRes, lRes] = await Promise.all([
      apiGet<Task[]>('/tasks', { stationId }),
      apiGet<TaskLog[]>('/task-logs', { stationId }),
    ])
    if (tRes.ok && Array.isArray(tRes.data)) setTasks(tRes.data)
    else {
      setTasks([])
      if (!tRes.ok) setError(tRes.error)
    }
    if (lRes.ok && Array.isArray(lRes.data)) setLogs(lRes.data)
    else if (!lRes.ok) setError((p) => (p ? `${p}; ${lRes.error}` : lRes.error))
    setLoading(false)
  }, [stationId])

  useEffect(() => {
    void load()
  }, [load])

  const date = toISODateLocal(new Date())
  const now = new Date()
  const open = countOpenTasks(tasks, logs, date, now)
  const overdue = countOverdueTasks(tasks, logs, date, now)

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
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className={`min-w-0 flex-1 text-[10px] leading-tight ${open === 0 ? 'text-[var(--text-muted)]' : overdue > 0 ? 'text-red-300/95' : 'text-emerald-200/85'}`}>
        {open === 0
          ? 'Keine offenen Aufgaben.'
          : overdue > 0
            ? `${overdue} überfällig`
            : 'Keine Überfälligen'}
      </p>
      <Link
        to="/tasks"
        className="inline-flex shrink-0 items-center rounded border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 hover:bg-cyan-500/20"
      >
        Öffnen
      </Link>
    </div>
  )

  return (
    <StatCard
      title="Offene Aufgaben"
      value={valueNode}
      density="compact"
      compactFooter={compactFooter}
      className="min-h-0 min-w-[150px]"
      icon={<ClipboardList className="h-[18px] w-[18px] text-lime-200" />}
      accentClass="neon-border-lime"
    />
  )
}

function OffeneSchichtenIcon() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center">
      <UserRound className="h-4 w-4 text-amber-200" aria-hidden />
      <AlertTriangle className="absolute -right-0.5 -top-0.5 h-3 w-3 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" aria-hidden />
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
      <div className="kpi-grid grid w-full min-w-0 grid-cols-[repeat(auto-fit,minmax(168px,1fr))] gap-3">
        <OpenTasksStatCompact />
        <StatCard
          density="compact"
          title="Heute im Dienst"
          value={dienstValue}
          className="min-w-[150px]"
          icon={<CalendarClock className="h-[18px] w-[18px] text-cyan-200" />}
          accentClass="neon-border-cyan"
        />
        <StatCard
          density="compact"
          title="Abwesenheiten"
          value={abwValue}
          className="min-w-[150px]"
          icon={<Plane className="h-[18px] w-[18px] text-pink-200" />}
          accentClass="neon-border-pink"
        />
        <StatCard
          density="compact"
          title="Offene Schichten"
          value={offenValue}
          compactFooter={offenFooter}
          onClick={shiftError || loading ? undefined : () => setOpenShiftsModal(true)}
          className="min-w-[150px]"
          icon={<OffeneSchichtenIcon />}
          accentClass="neon-border-amber"
        />
      </div>
      {!loading && !shiftError && totalToday === 0 ? (
        <p className="text-center text-xs text-[var(--text-faint)]">Heute keine Schichten geplant.</p>
      ) : null}
    </div>
  )
}
