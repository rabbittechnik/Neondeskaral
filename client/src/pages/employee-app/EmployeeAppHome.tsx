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
  getMondayOfWeekContaining,
  localTodayYmd,
} from '../../utils/dateFormat'
import { setStoredEmployeeAccessSession } from './employeeAppStorage'
import { EmployeeWeekPlanTab } from './EmployeeWeekPlanTab'
import { EmployeeUrlaubTab } from './EmployeeUrlaubTab'

type PubEmp = {
  id: string
  displayName: string
  role?: string
}

type PubStation = { id: string; name: string }

type PubShift = { id: string; date: string; startTime: string; endTime: string }

type PubTask = { id: string; title: string; active?: boolean }

type PubAbsence = {
  id: string
  type: string
  startDate: string
  endDate: string
  halfDay?: boolean
  status: string
  comment?: string
  requestedAt?: string
  approvedAt?: string
  rejectedReason?: string
}

type Payload = {
  employee: PubEmp
  station: PubStation
  shifts: PubShift[]
  tasks: PubTask[]
  absences: PubAbsence[]
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

  const today = useMemo(() => localTodayYmd(), [])

  const planned = useMemo(() => {
    if (!payload) return undefined
    return plannedToday(payload.shifts, today)
  }, [payload, today])

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
  }, [payload])

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
        <p className="max-w-md text-slate-400">Bitte wende dich an die Stationsleitung.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {onClearSession ? (
            <Button type="button" variant="outline" onClick={() => onClearSession()}>
              Zugang entfernen
            </Button>
          ) : null}
          <Link
            to="/employee-app"
            className="inline-flex items-center justify-center rounded-xl border border-cyan-400/40 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/10"
          >
            Neu einrichten
          </Link>
        </div>
      </div>
    )
  }

  const { employee, station, tasks, absences } = payload
  const running = payload.runningTimeEntry
  const openTasks = tasks.filter((x) => x.active !== false).slice(0, 16)

  const statusLine = running
    ? `Schicht läuft · Anwesend seit ${formatTimeDE(running.startAt)} · ${runningDuration(running.startAt)}`
    : planned
      ? `Heute geplant: ${formatShiftTimeRangeDE(planned.startTime, planned.endTime)} · Noch nicht gestartet`
      : 'Heute ist keine Schicht geplant'

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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-3 pb-32 pt-4 md:max-w-4xl">
      <header className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900/90 to-slate-950/95 p-4 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
        <p className="text-xs font-medium uppercase tracking-wider text-cyan-300/80">Mitarbeiter-App</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Hallo, {employee.displayName}</h1>
        <p className="mt-1 text-sm text-slate-400">Deine persönliche Übersicht für {station.name}</p>
        {employee.role ? (
          <p className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {employee.role}
          </p>
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
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Heute · {formatWeekdayDateDE(today)}</p>
            <p className="mt-2 text-base text-slate-100">{statusLine}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="primary"
                className="min-h-[52px] py-3 text-base font-semibold"
                disabled={busy || Boolean(running)}
                onClick={() => setCheckInConfirmOpen(true)}
              >
                Schicht starten
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[52px] border-orange-400/40 py-3 text-base font-semibold text-orange-100 hover:bg-orange-500/10"
                disabled={busy || !running}
                onClick={() => setCheckoutConfirmOpen(true)}
              >
                Schicht beenden
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-cyan-200">Nächste Schicht</h2>
            {planned ? (
              <p className="mt-2 text-lg text-white">
                {formatWeekdayDateDE(planned.date)} · {formatShiftTimeRangeDE(planned.startTime, planned.endTime)}
              </p>
            ) : (
              <p className="mt-2 text-slate-400">Keine geplant.</p>
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
            <ul className="space-y-2">
              {weekShiftsMine.map((s) => (
                <li key={s.id} className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-3 text-sm text-slate-100">
                  <span className="font-medium text-white">{formatWeekdayDateDE(s.date)}</span>
                  <span className="text-slate-400"> · </span>
                  {formatShiftTimeRangeDE(s.startTime, s.endTime)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'wochenplan' ? (
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-semibold text-cyan-200">Kompletter Wochenplan</h2>
          <EmployeeWeekPlanTab accessToken={t} />
        </section>
      ) : null}

      {tab === 'aufgaben' ? (
        <section className="mt-5 space-y-2">
          <h2 className="text-sm font-semibold text-cyan-200">Meine Aufgaben</h2>
          {openTasks.length === 0 ? (
            <p className="text-slate-400">Keine offenen Aufgaben.</p>
          ) : (
            openTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-3 text-sm">
                {task.title}
              </div>
            ))
          )}
        </section>
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
                  <p className="font-medium text-white">
                    {formatDateDE((e.startAt ?? '').slice(0, 10))} · {formatTimeDE(e.startAt)} –{' '}
                    {e.endAt ? formatTimeDE(e.endAt) : '—'}
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
                {planned ? formatShiftTimeRangeDE(planned.startTime, planned.endTime) : '—'}
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
