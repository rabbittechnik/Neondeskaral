import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Home,
  Info,
  LogOut,
  Palmtree,
  Timer,
} from 'lucide-react'
import { employeeAccessGet, employeeAccessPost } from '../../services/api'
import type { Task, TaskLog } from '../../types/task'
import type { ShiftCloseChecklist, TimeEntry } from '../../types/timeTracking'
import { ShiftCloseChecklistModal } from '../../components/terminal/ShiftCloseChecklistModal'
import { ShiftCloseSuccessCard } from '../../components/terminal/ShiftCloseSuccessCard'
import { Button } from '../../components/ui/Button'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../utils/timeTrackingUtils'
import {
  addDaysYmd,
  formatDateDE,
  formatShiftTimeRangeDE,
  formatTimeDE,
  formatWeekdayDateDE,
  formatWeekdayLongDE,
  getMondayOfWeekContaining,
  localTodayYmd,
} from '../../utils/dateFormat'
import { getTaskStatusForDate, isTaskDueOnDate } from '../../utils/taskUtils'
import { setStoredEmployeeAccessSession } from './employeeAppStorage'
import { EmployeeWeekPlanTab } from './EmployeeWeekPlanTab'
import type { EmployeeAbsenceRow } from './EmployeeUrlaubTab'
import { EmployeeUrlaubTab } from './EmployeeUrlaubTab'
import { EmployeeTasksTab } from './EmployeeTasksTab'
import {
  computeTodayEmployeeStatus,
  findNextFutureShift,
  findNextFutureShifts,
  type PubShiftLite,
} from './employeeAppShiftUtils'

type PubEmp = {
  id: string
  displayName: string
  role?: string
  roleLabel?: string
  color?: string
}

type PubStation = { id: string; name: string }

type PubShift = PubShiftLite & { workAreaId?: string; shiftType?: string; status?: string }

type Payload = {
  employee: PubEmp
  station: PubStation
  workAreas: { id: string; name: string }[]
  shifts: PubShift[]
  tasks: Task[]
  taskLogs: TaskLog[]
  absences: EmployeeAbsenceRow[]
  timeEntries: TimeEntry[]
  runningTimeEntry?: TimeEntry
}

function plannedToday(shifts: PubShift[], today: string): PubShift | undefined {
  const list = shifts.filter((s) => s.date === today && s.startTime && s.endTime)
  if (!list.length) return undefined
  list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  return list[0]
}

function runningDuration(startAt: string): string {
  const m = calculateWorkedMinutes(startAt, undefined, new Date())
  return formatWorkedDuration(m)
}

function timeEntryApprovalHint(e: TimeEntry): string {
  const a = e.approvalStatus ?? 'pending'
  if (a === 'approved' && e.payrollRelevant) return 'Deine Arbeitszeit wurde freigegeben.'
  if (a === 'rejected') return 'Deine Arbeitszeit wurde abgelehnt. Bitte wende dich an den Teamleiter.'
  if (a === 'correction_required') return 'Deine Arbeitszeit muss geprüft/korrigiert werden.'
  if (a === 'pending' || !e.payrollRelevant) return 'Deine Arbeitszeit wurde erfasst und wartet auf Freigabe.'
  return 'Deine Arbeitszeit wurde erfasst und wartet auf Freigabe.'
}

export type TabId =
  | 'heute'
  | 'meine-schichten'
  | 'wochenplan'
  | 'aufgaben'
  | 'urlaub'
  | 'arbeitszeiten'
  | 'info'

type Props = {
  accessToken: string
  persistSession?: boolean
  onSessionStored?: () => void
  onClearSession?: () => void
}

function useStandalonePwa(): boolean {
  const [s, setS] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const upd = () => {
      const nav = window.navigator as Navigator & { standalone?: boolean }
      setS(mq.matches || nav.standalone === true)
    }
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])
  return s
}

export function EmployeeAppHome({ accessToken, persistSession, onSessionStored, onClearSession }: Props) {
  const t = accessToken
  const standalone = useStandalonePwa()
  const sessionWritten = useRef(false)

  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'invalid'>('loading')
  const [payload, setPayload] = useState<Payload | null>(null)
  const [tab, setTab] = useState<TabId>('heute')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [inOk, setInOk] = useState<string | null>(null)

  const [forcePrompt, setForcePrompt] = useState<{
    title?: string
    body: string
    confirmLabel?: string
    after: () => void
  } | null>(null)

  const [checkInConfirmOpen, setCheckInConfirmOpen] = useState(false)
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false)

  const [checklistOpen, setChecklistOpen] = useState(false)
  const [checkoutEntry, setCheckoutEntry] = useState<TimeEntry | null>(null)
  const [outOk, setOutOk] = useState<{ name: string; end: string; dur: string } | null>(null)

  const load = useCallback(async () => {
    if (!t) {
      setLoadState('invalid')
      return
    }
    setLoadState('loading')
    const res = await employeeAccessGet<Payload>(t)
    if (!res.ok) {
      setLoadState('invalid')
      setPayload(null)
      return
    }
    setPayload(res.data)
    setLoadState('ok')
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (loadState !== 'ok' || !payload || !persistSession || sessionWritten.current) return
    sessionWritten.current = true
    setStoredEmployeeAccessSession(t, payload.employee.displayName, payload.station.name)
    onSessionStored?.()
  }, [loadState, payload, persistSession, t, onSessionStored])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const todayStr = localTodayYmd()

  const shiftStatus = useMemo(() => {
    if (!payload) return { variant: 'no_shift' as const }
    void tick
    const now = new Date()
    return computeTodayEmployeeStatus(
      payload.shifts,
      todayStr,
      now,
      payload.runningTimeEntry,
      payload.timeEntries,
      payload.employee.id,
    )
  }, [payload, todayStr, tick])

  const nextShift = useMemo(() => {
    if (!payload) return undefined
    void tick
    return findNextFutureShift(payload.shifts, new Date())
  }, [payload, tick])

  const nextThreeShifts = useMemo(() => {
    if (!payload) return [] as PubShiftLite[]
    void tick
    return findNextFutureShifts(payload.shifts, new Date(), 3)
  }, [payload, tick])

  const openTasksPreview = useMemo(() => {
    if (!payload) return [] as Task[]
    void tick
    const now = new Date()
    const out: Task[] = []
    for (const task of payload.tasks) {
      if (!task.active) continue
      if (!isTaskDueOnDate(task, todayStr)) continue
      const st = getTaskStatusForDate(task, payload.taskLogs, todayStr, now)
      if (st === 'offen' || st === 'überfällig' || st === 'in_kontrolle') {
        out.push(task)
        if (out.length >= 3) break
      }
    }
    return out
  }, [payload, todayStr, tick])

  const recentTimeEntries = useMemo(() => {
    if (!payload) return []
    const mine = payload.timeEntries.filter((e) => e.employeeId === payload.employee.id && e.status === 'completed')
    mine.sort((a, b) => String(b.endAt ?? b.startAt).localeCompare(String(a.endAt ?? a.startAt)))
    return mine.slice(0, 12)
  }, [payload])

  const weekShiftsMine = useMemo(() => {
    if (!payload) return []
    const mon = getMondayOfWeekContaining()
    const sun = addDaysYmd(mon, 6)
    return payload.shifts
      .filter((s) => s.date >= mon && s.date <= sun)
      .sort((x, y) => x.date.localeCompare(y.date) || x.startTime.localeCompare(y.startTime))
  }, [payload, todayStr])

  const tryCheckIn = async (force: boolean) => {
    setCheckInConfirmOpen(false)
    setBusy(true)
    setMsg(null)
    setInOk(null)
    try {
      const raw = await employeeAccessPost(t, 'check-in', { force })
      if (raw.ok === true && raw.data && typeof raw.data === 'object') {
        const d = raw.data as { message?: string; timeEntry?: TimeEntry }
        const startLabel = d.timeEntry ? formatTimeDE(d.timeEntry.startAt) : ''
        setInOk(d.message ?? `Deine Schicht wurde gestartet. Startzeit: ${startLabel}`)
        await load()
        setBusy(false)
        return
      }
      const result = String(raw.result ?? '')
      const message = String(raw.message ?? raw.error ?? 'Nicht möglich')
      if (!force && (result === 'not_scheduled' || result === 'too_early' || result === 'too_late')) {
        setForcePrompt({
          title: result === 'too_late' ? 'Verspäteter Start' : 'Hinweis',
          body: message,
          confirmLabel: result === 'too_late' ? 'Schicht trotzdem starten' : 'Trotzdem starten',
          after: () => {
            setForcePrompt(null)
            void tryCheckIn(true)
          },
        })
        setBusy(false)
        return
      }
      setMsg(message)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler')
    }
    setBusy(false)
  }

  const startCheckout = async () => {
    setCheckoutConfirmOpen(false)
    setBusy(true)
    setMsg(null)
    try {
      const raw = await employeeAccessPost(t, 'check-out-start', {})
      if (raw.ok === true && raw.data && typeof raw.data === 'object') {
        const d = raw.data as { timeEntry?: TimeEntry }
        if (d.timeEntry) {
          setCheckoutEntry(d.timeEntry)
          setChecklistOpen(true)
        }
        setBusy(false)
        return
      }
      setMsg(String(raw.message ?? raw.error ?? 'Ausstempeln nicht möglich'))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler')
    }
    setBusy(false)
  }

  const completeCheckout = async (checklist: ShiftCloseChecklist) => {
    if (!checkoutEntry || !payload) return
    setBusy(true)
    try {
      const raw = await employeeAccessPost(t, 'check-out-complete', {
        timeEntryId: checkoutEntry.id,
        checklist: {
          fridgeFronted: checklist.fridgeFronted,
          drinksFilled: checklist.drinksFilled,
          cigarettesFilled: checklist.cigarettesFilled,
          shelvesFilled: checklist.shelvesFilled,
          trashEmptied: checklist.trashEmptied,
          counterClean: checklist.counterClean,
          coffeeAreaClean: checklist.coffeeAreaClean,
          outsideChecked: checklist.outsideChecked,
          incidentsNoted: checklist.incidentsNoted,
          handoverPossible: checklist.handoverPossible,
          closingReady: checklist.closingReady,
          everythingOk: checklist.everythingOk,
          incidentNote: checklist.incidentNote,
        },
      })
      if (raw.ok === true && raw.data && typeof raw.data === 'object') {
        const te = raw.data as TimeEntry
        const end = te.endAt ? formatTimeDE(te.endAt) : ''
        const mins = te.endAt ? calculateWorkedMinutes(te.startAt, te.endAt) : 0
        const name = payload.employee.displayName
        setOutOk({ name, end, dur: formatWorkedDuration(mins) })
        setChecklistOpen(false)
        setCheckoutEntry(null)
        await load()
      } else {
        setMsg(String(raw.error ?? 'Abschluss fehlgeschlagen'))
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler')
    }
    setBusy(false)
  }

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 text-slate-400">
        Deine Daten werden geladen…
      </div>
    )
  }

  if (loadState === 'invalid' || !payload) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-semibold text-white">Dein Mitarbeiterzugang ist ungültig oder wurde deaktiviert.</p>
        <p className="max-w-md text-slate-400">
          Bitte wende dich an die Stationsleitung oder scanne einen neuen QR-Code, falls du einen erhalten hast.
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:max-w-sm">
          {onClearSession ? (
            <Button type="button" variant="primary" className="w-full" onClick={() => onClearSession()}>
              QR-Code erneut scannen
            </Button>
          ) : (
            <Link
              to="/employee-app"
              className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              QR-Code erneut scannen
            </Link>
          )}
          <p className="text-center text-xs text-slate-500">
            Der Zugang bleibt auf dem Server in der Datenbank gespeichert — nur dieses Gerät muss neu verbunden
            werden.
          </p>
        </div>
      </div>
    )
  }

  const { employee, station, tasks, absences, workAreas, taskLogs } = payload
  const running = payload.runningTimeEntry
  const accent = employee.color ?? '#22d3ee'
  const roleBadge = (employee.roleLabel ?? employee.role ?? '').trim()

  const workAreaName = (id: string) => workAreas.find((w) => w.id === id)?.name ?? '–'

  const shiftForCheckInDialog =
    shiftStatus.variant === 'upcoming' || shiftStatus.variant === 'during_no_clock'
      ? shiftStatus.shift
      : plannedToday(payload.shifts, todayStr)

  const canStartShift = shiftStatus.variant === 'upcoming' || shiftStatus.variant === 'during_no_clock'
  const startShiftDisabledReason =
    shiftStatus.variant === 'running'
      ? 'Schicht läuft bereits.'
      : shiftStatus.variant === 'no_shift'
        ? 'Heute ist keine Schicht geplant.'
        : shiftStatus.variant === 'past_completed' || shiftStatus.variant === 'past_no_time'
          ? 'Die heutige Schichtzeit ist vorbei.'
          : null

  const navItems = [
    { id: 'heute' as const, label: 'Heute', Icon: Home },
    { id: 'meine-schichten' as const, label: 'Meine Schichten', Icon: CalendarDays },
    { id: 'wochenplan' as const, label: 'Wochenplan', Icon: CalendarRange },
    { id: 'aufgaben' as const, label: 'Aufgaben', Icon: CheckSquare },
    { id: 'urlaub' as const, label: 'Urlaub', Icon: Palmtree },
    { id: 'arbeitszeiten' as const, label: 'Arbeitszeiten', Icon: Timer },
    { id: 'info' as const, label: 'Info', Icon: Info },
  ]

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-3 pb-32 pt-0 md:max-w-4xl">
      <div
        className="-mx-3 mb-3 flex items-center justify-center border-b border-cyan-500/35 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-2.5 text-center shadow-[0_0_24px_rgba(34,211,238,0.15)]"
        style={{ boxShadow: `0 0 28px ${accent}33, inset 0 -1px 0 rgba(34,211,238,0.2)` }}
      >
        <p className="text-sm font-semibold tracking-wide text-cyan-100">{station.name}</p>
      </div>

      <header
        className="relative overflow-hidden rounded-2xl border border-cyan-500/30 p-4 shadow-[0_0_40px_rgba(34,211,238,0.14)]"
        style={{
          background: `linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.98) 60%, ${accent}12 100%)`,
          boxShadow: `0 0 36px ${accent}28`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl"
          style={{ background: accent, opacity: 0.22 }}
        />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">Mitarbeiter-App</p>
        <h1 className="relative mt-1 text-2xl font-bold text-white">Hallo, {employee.displayName}</h1>
        <p className="relative mt-1 text-sm text-slate-300">
          Deine persönliche Schichtübersicht für <span className="font-medium text-cyan-100/95">{station.name}</span>
        </p>
        {roleBadge ? (
          <span
            className="relative mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-slate-100"
            style={{
              borderColor: `${accent}66`,
              background: `${accent}18`,
              boxShadow: `0 0 18px ${accent}35`,
            }}
          >
            {roleBadge}
          </span>
        ) : null}
      </header>

      {inOk ? (
        <div className="mt-4 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {inOk}
          <button type="button" className="ml-3 underline" onClick={() => setInOk(null)}>
            OK
          </button>
        </div>
      ) : null}

      {msg ? (
        <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {msg}
        </div>
      ) : null}

      {tab === 'heute' ? (
        <section className="mt-5 space-y-4">
          <div
            className="rounded-2xl border border-white/12 bg-slate-900/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 28px ${accent}14` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Heute · {formatWeekdayDateDE(todayStr)}
            </p>

            {shiftStatus.variant === 'no_shift' ? (
              <>
                <p className="mt-3 text-base font-medium text-slate-100">Heute keine weitere Schicht geplant.</p>
                <p className="mt-1 text-sm text-slate-400">Status: Keine Schicht im Plan</p>
              </>
            ) : null}

            {shiftStatus.variant === 'upcoming' ? (
              <>
                <p className="mt-3 text-base text-slate-100">
                  Heute geplant:{' '}
                  <span className="font-semibold text-white">
                    {formatShiftTimeRangeDE(shiftStatus.shift.startTime, shiftStatus.shift.endTime)}
                  </span>
                </p>
                <p className="mt-2 text-sm text-cyan-200/95">Status: Noch nicht gestartet</p>
              </>
            ) : null}

            {shiftStatus.variant === 'during_no_clock' ? (
              <>
                <p className="mt-3 text-base text-slate-100">
                  Heute geplant:{' '}
                  <span className="font-semibold text-white">
                    {formatShiftTimeRangeDE(shiftStatus.shift.startTime, shiftStatus.shift.endTime)}
                  </span>
                </p>
                <p className="mt-2 text-sm text-amber-100/95">Status: Schichtzeit aktiv – noch nicht eingestempelt</p>
              </>
            ) : null}

            {shiftStatus.variant === 'running' ? (
              <>
                <p className="mt-3 text-base text-slate-100">
                  Heute geplant:{' '}
                  <span className="font-semibold text-white">
                    {formatShiftTimeRangeDE(shiftStatus.shift.startTime, shiftStatus.shift.endTime)}
                  </span>
                </p>
                <p className="mt-2 text-sm text-emerald-100/95">Status: Schicht läuft</p>
                <p className="mt-1 text-sm text-slate-300">
                  Anwesend seit: <span className="text-white">{formatTimeDE(shiftStatus.running.startAt)}</span>
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Laufende Zeit:{' '}
                  <span className="font-medium text-cyan-100">{runningDuration(shiftStatus.running.startAt)}</span>
                </p>
              </>
            ) : null}

            {shiftStatus.variant === 'past_no_time' ? (
              <>
                <p className="mt-3 text-base text-slate-100">
                  Heutige Schicht:{' '}
                  <span className="font-semibold text-white">
                    {formatShiftTimeRangeDE(shiftStatus.shift.startTime, shiftStatus.shift.endTime)}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-300">Status: Schichtzeit bereits vorbei</p>
                <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-50/95">
                  Für diese Schicht wurde keine Arbeitszeit gestartet.
                </p>
              </>
            ) : null}

            {shiftStatus.variant === 'past_completed' ? (
              <>
                <p className="mt-3 text-base font-semibold text-white">Heutige Schicht beendet</p>
                <p className="mt-1 text-sm text-slate-200">
                  Gestempelt: {formatTimeDE(shiftStatus.entry.startAt)} –{' '}
                  {shiftStatus.entry.endAt ? formatTimeDE(shiftStatus.entry.endAt) : '—'}
                </p>
                <p className="mt-2 text-sm text-slate-300">{timeEntryApprovalHint(shiftStatus.entry)}</p>
              </>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="primary"
                title={!canStartShift && startShiftDisabledReason ? startShiftDisabledReason : undefined}
                className="min-h-[52px] border border-emerald-400/45 bg-gradient-to-r from-emerald-600/90 to-cyan-600/85 py-3 text-base font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:from-emerald-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={busy || Boolean(running) || !canStartShift}
                onClick={() => setCheckInConfirmOpen(true)}
              >
                Schicht starten
              </Button>
              <Button
                type="button"
                variant="outline"
                title={!running ? 'Nur während einer laufenden Schicht möglich.' : undefined}
                className="min-h-[52px] border-orange-400/50 bg-orange-500/10 py-3 text-base font-semibold text-orange-50 shadow-[0_0_16px_rgba(249,115,22,0.2)] hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={busy || !running}
                onClick={() => setCheckoutConfirmOpen(true)}
              >
                Schicht beenden
              </Button>
            </div>
            {!canStartShift && startShiftDisabledReason ? (
              <p className="mt-2 text-center text-xs text-slate-500">{startShiftDisabledReason}</p>
            ) : null}
          </div>

          <div
            className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-4"
            style={{ boxShadow: `0 0 20px ${accent}12` }}
          >
            <h2 className="text-sm font-semibold text-cyan-200">Nächste Schicht</h2>
            {nextShift ? (
              <div className="mt-2">
                <p className="text-lg font-medium text-white">{formatWeekdayDateDE(nextShift.date)}</p>
                <p className="mt-1 text-base text-slate-200">{formatShiftTimeRangeDE(nextShift.startTime, nextShift.endTime)}</p>
                <p className="mt-1 text-xs text-slate-500">Arbeitsbereich: {workAreaName(nextShift.workAreaId ?? '')}</p>
              </div>
            ) : (
              <p className="mt-2 text-slate-400">Keine weitere Schicht im aktuellen Plan.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-cyan-200">Heute fällige Aufgaben</h2>
              <button
                type="button"
                className="text-xs font-medium text-cyan-300 underline-offset-2 hover:underline"
                onClick={() => setTab('aufgaben')}
              >
                Aufgaben öffnen
              </button>
            </div>
            {openTasksPreview.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Keine offenen Aufgaben für heute.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {openTasksPreview.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
                  >
                    <span className="font-medium text-white">{task.title}</span>
                    <span className="block text-xs text-slate-400">
                      {formatShiftTimeRangeDE(task.startTime, task.endTime)} · {workAreaName(task.workAreaId)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-cyan-200">Wochenvorschau</h2>
              <button
                type="button"
                className="text-xs font-medium text-cyan-300 underline-offset-2 hover:underline"
                onClick={() => setTab('wochenplan')}
              >
                Wochenplan öffnen
              </button>
            </div>
            {nextThreeShifts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Keine kommenden Schichten im Plan.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {nextThreeShifts.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
                  >
                    <span className="font-medium text-white">{formatWeekdayDateDE(s.date)}</span>
                    <span className="block text-xs text-slate-400">{formatShiftTimeRangeDE(s.startTime, s.endTime)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {tab === 'meine-schichten' ? (
        <section className="mt-5 space-y-3">
          <h2 className="text-sm font-semibold text-cyan-200">Meine Schichten (Kalenderwoche)</h2>
          <p className="text-xs text-slate-500">
            {formatWeekdayDateDE(getMondayOfWeekContaining())} bis {formatWeekdayDateDE(addDaysYmd(getMondayOfWeekContaining(), 6))}
          </p>
          {weekShiftsMine.length === 0 ? (
            <p className="text-slate-400">Keine Schichten in dieser Woche.</p>
          ) : (
            <ul className="space-y-3">
              {weekShiftsMine.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-slate-100"
                  style={{ boxShadow: `0 0 16px ${accent}10` }}
                >
                  <p className="text-base font-semibold text-white">{formatWeekdayLongDE(s.date)}</p>
                  <p className="text-xs text-slate-400">{formatDateDE(s.date)}</p>
                  <p className="mt-2 font-medium text-cyan-100/90">{formatShiftTimeRangeDE(s.startTime, s.endTime)}</p>
                  <p className="text-xs text-slate-500">Arbeitsbereich: {workAreaName(s.workAreaId ?? '')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'wochenplan' ? (
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-semibold text-cyan-200">Kompletter Wochenplan</h2>
          <EmployeeWeekPlanTab accessToken={t} viewerEmployeeId={employee.id} />
        </section>
      ) : null}

      {tab === 'aufgaben' ? (
        <EmployeeTasksTab
          accessToken={t}
          tasks={tasks}
          taskLogs={taskLogs}
          workAreaName={workAreaName}
          onReload={load}
        />
      ) : null}

      {tab === 'urlaub' ? (
        <EmployeeUrlaubTab accessToken={t} absences={absences} onReload={load} />
      ) : null}

      {tab === 'arbeitszeiten' ? (
        <section className="mt-5 space-y-2">
          <h2 className="text-sm font-semibold text-cyan-200">Arbeitszeiten</h2>
          {recentTimeEntries.length === 0 ? (
            <p className="text-slate-400">Noch keine erfassten Zeiten.</p>
          ) : (
            <ul className="space-y-3">
              {recentTimeEntries.map((e) => (
                <li key={e.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm">
                  <p className="font-medium text-white">{formatWeekdayDateDE((e.startAt ?? '').slice(0, 10))}</p>
                  <p className="text-slate-300">
                    {formatTimeDE(e.startAt)} – {e.endAt ? formatTimeDE(e.endAt) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{timeEntryApprovalHint(e)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'info' ? (
        <section className="mt-5 space-y-4 text-sm text-slate-300">
          <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-4">
            <p className="font-semibold text-cyan-100">Gerät</p>
            <p className="mt-2">
              Dieses Gerät ist verbunden mit: <span className="text-white">{employee.displayName}</span> · {station.name}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 border-red-400/40 text-red-200 hover:bg-red-500/10"
              onClick={() => onClearSession?.()}
            >
              <LogOut className="mr-2 inline h-4 w-4" aria-hidden />
              Mitarbeiterzugang von diesem Gerät entfernen
            </Button>
          </div>

          {!standalone ? (
            <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-4">
              <p className="font-semibold text-cyan-100">App installieren</p>
              <p className="mt-2">Du kannst diese Mitarbeiter-App auf deinem Handy installieren.</p>
              <p className="mt-2 text-slate-400">
                <span className="font-medium text-slate-200">Android (Chrome):</span> Browser-Menü öffnen und „App installieren“
                oder „Zum Startbildschirm hinzufügen“ wählen.
              </p>
              <p className="mt-2 text-slate-400">
                <span className="font-medium text-slate-200">iPhone (Safari):</span> Teilen-Symbol antippen und „Zum Home-Bildschirm“
                wählen.
              </p>
            </div>
          ) : null}

          <p className="text-center text-xs text-slate-500">Bei Fragen wende dich an {station.name}.</p>
        </section>
      ) : null}

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#070b12]/95 px-1 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg gap-1 overflow-x-auto pb-safe md:max-w-4xl">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium ${
                tab === id ? 'bg-cyan-500/15 text-cyan-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {checkInConfirmOpen ? (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/35 bg-slate-900 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Schicht wirklich starten?</h2>
            <p className="mt-2 text-sm text-slate-300">Möchtest du dich wirklich zur Schicht anmelden?</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100">
              <p>
                <span className="text-slate-500">Mitarbeiter:</span> {employee.displayName}
              </p>
              <p>
                <span className="text-slate-500">Geplante Schicht:</span>{' '}
                {shiftForCheckInDialog
                  ? formatShiftTimeRangeDE(shiftForCheckInDialog.startTime, shiftForCheckInDialog.endTime)
                  : '—'}
              </p>
              <p>
                <span className="text-slate-500">Aktuelle Uhrzeit:</span> {formatTimeDE(new Date())}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCheckInConfirmOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" disabled={busy} onClick={() => void tryCheckIn(false)}>
                Ja, Schicht starten
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {checkoutConfirmOpen && running ? (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-orange-400/35 bg-slate-900 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Schicht wirklich beenden?</h2>
            <p className="mt-2 text-sm text-slate-300">Möchtest du deine Schicht jetzt wirklich beenden?</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100">
              <p>
                <span className="text-slate-500">Mitarbeiter:</span> {employee.displayName}
              </p>
              <p>
                <span className="text-slate-500">Startzeit:</span> {formatTimeDE(running.startAt)}
              </p>
              <p>
                <span className="text-slate-500">Bisherige Arbeitszeit:</span> {runningDuration(running.startAt)}
              </p>
              <p>
                <span className="text-slate-500">Aktuelle Uhrzeit:</span> {formatTimeDE(new Date())}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCheckoutConfirmOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" disabled={busy} onClick={() => void startCheckout()}>
                Ja, Schicht beenden
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {forcePrompt ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 p-5 shadow-xl">
            <p className="text-base text-white">{forcePrompt.title ?? 'Hinweis'}</p>
            <p className="mt-2 text-sm text-slate-300">{forcePrompt.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setForcePrompt(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => {
                  forcePrompt.after()
                }}
              >
                {forcePrompt.confirmLabel ?? 'Trotzdem starten'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {checkoutEntry ? (
        <ShiftCloseChecklistModal
          open={checklistOpen}
          employeeName={employee.displayName}
          timeEntryId={checkoutEntry.id}
          employeeId={employee.id}
          onClose={() => {
            setChecklistOpen(false)
            setCheckoutEntry(null)
          }}
          onComplete={(c) => void completeCheckout(c)}
        />
      ) : null}

      {outOk ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4">
          <ShiftCloseSuccessCard
            employeeName={outOk.name}
            endTimeLabel={outOk.end}
            durationLabel={outOk.dur}
            onDismiss={() => setOutOk(null)}
          />
        </div>
      ) : null}
    </div>
  )
}
