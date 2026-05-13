import { useMemo, useState } from 'react'
import type { Task, TaskLog } from '../../types/task'
import { getTaskStatusForDate, isTaskDueOnDate, recurrenceSummary, taskDisplayTimingLine } from '../../utils/taskUtils'
import { addDaysYmd, formatWeekdayDateDE, localTodayYmd } from '../../utils/dateFormat'
import { Button } from '../../components/ui/Button'
import { employeeAccessPostJson } from '../../services/api'

type Props = {
  accessToken: string
  tasks: Task[]
  /** Vom Server getrennt: Abschluss-/Pflichtaufgaben zur Schichtbeendigung */
  tasksShiftClose?: Task[]
  taskLogs: TaskLog[]
  workAreaName: (id: string) => string
  onReload: () => Promise<void>
}

function statusLabel(st: string | null): string {
  if (!st) return '—'
  const map: Record<string, string> = {
    offen: 'Offen',
    überfällig: 'Überfällig',
    erledigt: 'Erledigt',
    in_kontrolle: 'Wartet auf Kontrolle',
    kontrolliert: 'Kontrolliert',
    mangel: 'Mangel',
    deaktiviert: 'Deaktiviert',
  }
  return map[st] ?? st
}

export function EmployeeTasksTab({
  accessToken,
  tasks,
  tasksShiftClose = [],
  taskLogs,
  workAreaName,
  onReload,
}: Props) {
  const now = new Date()
  const today = localTodayYmd()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmTask, setConfirmTask] = useState<Task | null>(null)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const { todayDue, openLater, shiftCloseOpenToday, doneRecent, noOpenWork } = useMemo(() => {
    const todayDue: Task[] = []
    const openLater: Task[] = []
    const doneRecent: { task: Task; date: string; status: string }[] = []
    const horizon = addDaysYmd(today, 14)

    for (const task of tasks) {
      if (!task.active) continue
      if (isTaskDueOnDate(task, today)) {
        const st = getTaskStatusForDate(task, taskLogs, today, now)
        if (st === 'offen' || st === 'überfällig' || st === 'in_kontrolle') {
          todayDue.push(task)
        }
        if (st === 'erledigt' || st === 'kontrolliert' || st === 'mangel') {
          doneRecent.push({ task, date: today, status: st })
        }
      }

      let d = addDaysYmd(today, 1)
      while (d <= horizon) {
        if (isTaskDueOnDate(task, d)) {
          const st = getTaskStatusForDate(task, taskLogs, d, now)
          if (st === 'offen' || st === 'überfällig') {
            if (!todayDue.find((x) => x.id === task.id) && !openLater.find((t) => t.id === task.id)) {
              openLater.push(task)
            }
            break
          }
        }
        d = addDaysYmd(d, 1)
      }

      for (const log of taskLogs) {
        if (log.taskId !== task.id) continue
        if (log.date < addDaysYmd(today, -7)) continue
        if (log.status === 'erledigt' || log.status === 'kontrolliert' || log.status === 'mangel') {
          if (!doneRecent.find((x) => x.task.id === task.id && x.date === log.date)) {
            doneRecent.push({ task, date: log.date, status: log.status })
          }
        }
      }
    }

    const shiftCloseOpenToday: Task[] = []
    for (const task of tasksShiftClose) {
      if (!task.active) continue
      if (!isTaskDueOnDate(task, today)) continue
      const st = getTaskStatusForDate(task, taskLogs, today, now)
      if (st === 'offen' || st === 'überfällig' || st === 'in_kontrolle') {
        shiftCloseOpenToday.push(task)
      }
      if (st === 'erledigt' || st === 'kontrolliert' || st === 'mangel') {
        if (!doneRecent.find((x) => x.task.id === task.id && x.date === today)) {
          doneRecent.push({ task, date: today, status: st })
        }
      }
      for (const log of taskLogs) {
        if (log.taskId !== task.id) continue
        if (log.date < addDaysYmd(today, -7)) continue
        if (log.status === 'erledigt' || log.status === 'kontrolliert' || log.status === 'mangel') {
          if (!doneRecent.find((x) => x.task.id === task.id && x.date === log.date)) {
            doneRecent.push({ task, date: log.date, status: log.status })
          }
        }
      }
    }

    doneRecent.sort((a, b) => `${b.date}`.localeCompare(`${a.date}`))
    const noOpenWork = todayDue.length === 0 && openLater.length === 0 && shiftCloseOpenToday.length === 0
    return {
      todayDue,
      openLater,
      shiftCloseOpenToday,
      doneRecent: doneRecent.slice(0, 40),
      noOpenWork,
    }
  }, [tasks, tasksShiftClose, taskLogs, today, now])

  const submitConfirm = async () => {
    if (!confirmTask) return
    setBusyId(confirmTask.id)
    setErr(null)
    const res = await employeeAccessPostJson<{ saved: boolean }>(
      accessToken,
      `tasks/${encodeURIComponent(confirmTask.id)}/confirm`,
      { comment: comment.trim() || undefined },
    )
    setBusyId(null)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setConfirmTask(null)
    setComment('')
    await onReload()
  }

  const renderCard = (task: Task, dueHint?: string) => {
    const due = dueHint ?? today
    const st = getTaskStatusForDate(task, taskLogs, due, now)
    const canComplete = st === 'offen' || st === 'überfällig'
    const labelBtn = task.controlRequired ? 'Erledigt melden' : 'Erledigt markieren'
    const timing = taskDisplayTimingLine(task)
    return (
      <div
        key={`${task.id}-${due}`}
        className="rounded-xl border border-white/12 bg-slate-900/55 p-4 shadow-[0_0_20px_rgba(34,211,238,0.06)]"
      >
        <p className="text-base font-semibold text-white">{task.title}</p>
        {timing ? (
          <p className="mt-1 text-sm text-slate-400">
            {timing}
            {task.recurrenceType !== 'once' ? ` · ${recurrenceSummary(task)}` : ''}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-400">{recurrenceSummary(task)}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">Arbeitsbereich: {workAreaName(task.workAreaId)}</p>
        {task.mandatory ? (
          <span className="mt-2 inline-block rounded border border-amber-400/35 px-2 py-0.5 text-[10px] text-amber-100">
            Pflichtaufgabe
          </span>
        ) : null}
        <p className="mt-2 text-sm text-cyan-100/90">
          Status: {statusLabel(st)}
          {dueHint && dueHint !== today ? ` · Fällig ${formatWeekdayDateDE(dueHint)}` : null}
        </p>
        {!canComplete && st === 'in_kontrolle' ? (
          <span className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
            Wartet auf Kontrolle
          </span>
        ) : null}
        {!canComplete && st === 'erledigt' ? (
          <span className="mt-2 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
            Erledigt
          </span>
        ) : null}
        {!canComplete && st === 'kontrolliert' ? (
          <span className="mt-2 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
            Kontrolliert
          </span>
        ) : null}
        {canComplete ? (
          <Button
            type="button"
            variant="primary"
            className="mt-3 min-h-[44px] w-full border-emerald-400/40 bg-gradient-to-r from-emerald-600/80 to-cyan-600/70 text-white hover:from-emerald-500/90 hover:to-cyan-500/80"
            disabled={busyId === task.id}
            onClick={() => {
              setConfirmTask(task)
              setComment('')
            }}
          >
            {labelBtn}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <section className="mt-5 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-cyan-200">Meine Aufgaben</h2>
        <p className="mt-1 text-xs text-slate-500">Heute, Schichtabschluss und die nächsten Tage</p>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>
      ) : null}

      {noOpenWork ? (
        <p className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
          Für deine aktuelle Schicht sind keine zusätzlichen Aufgaben eingetragen. Bitte normalen Schichtablauf und Abschlusscheck
          beachten.
        </p>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Heute / aktuelle Schicht</h3>
        <div className="mt-3 space-y-3">
          {todayDue.length === 0 ? (
            <p className="text-sm text-slate-500">Keine offenen Aufgaben für diese Schicht.</p>
          ) : (
            todayDue.map((t) => renderCard(t, today))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Schichtabschluss</h3>
        <p className="mt-1 text-xs text-slate-500">Diese Punkte sind beim Beenden der Schicht relevant.</p>
        <div className="mt-3 space-y-3">
          {shiftCloseOpenToday.length === 0 ? (
            <p className="text-sm text-slate-500">Keine zusätzlichen Abschlussaufgaben eingetragen.</p>
          ) : (
            shiftCloseOpenToday.map((t) => renderCard(t, today))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Demnächst</h3>
        <div className="mt-3 space-y-3">
          {openLater.length === 0 ? (
            <p className="text-sm text-slate-500">Keine weiteren offenen Aufgaben in den nächsten Tagen.</p>
          ) : (
            openLater.map((t) => {
              const max = addDaysYmd(today, 14)
              let nd = addDaysYmd(today, 1)
              let nextDue = ''
              while (nd <= max) {
                if (isTaskDueOnDate(t, nd)) {
                  const st = getTaskStatusForDate(t, taskLogs, nd, now)
                  if (st === 'offen' || st === 'überfällig') {
                    nextDue = nd
                    break
                  }
                }
                nd = addDaysYmd(nd, 1)
              }
              return renderCard(t, nextDue || undefined)
            })
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Erledigt</h3>
        <div className="mt-3 space-y-2">
          {doneRecent.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Einträge.</p>
          ) : (
            doneRecent.map(({ task, date, status }) => (
              <div key={`${task.id}-${date}`} className="rounded-lg border border-white/8 bg-black/25 px-3 py-2 text-sm text-slate-300">
                <span className="font-medium text-white">{task.title}</span>
                <span className="text-slate-500"> · {formatWeekdayDateDE(date)}</span>
                <span className="block text-xs text-emerald-200/80">{statusLabel(status)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {confirmTask ? (
        <div className="fixed inset-0 z-[118] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/35 bg-slate-900 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Aufgabe erledigt?</h2>
            <p className="mt-2 text-sm text-slate-300">
              Möchtest du bestätigen, dass du diese Aufgabe erledigt hast?
            </p>
            <p className="mt-2 text-sm font-medium text-cyan-100">{confirmTask.title}</p>
            <label className="mt-4 block text-xs text-slate-400">
              Kommentar optional
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmTask(null)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" disabled={Boolean(busyId)} onClick={() => void submitConfirm()}>
                Ja, erledigt
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
