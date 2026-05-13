import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStation } from '../../context/station-context'
import { useTabletTerminal } from '../../context/tablet-terminal-context'
import type { CheckInEvaluation, CheckOutEvaluation } from '../../utils/timeTrackingUtils'
import { calculateWorkedMinutes, evaluateCheckIn, evaluateCheckOut, formatWorkedDuration } from '../../utils/timeTrackingUtils'
import type { TimeEntry } from '../../types/timeTracking'
import type { CashRegisterCardEvent } from '../../types/timeTracking'
import { API_BASE } from '../../services/api'
import { DEFAULT_TABLET_STATION_ID } from '../../data/station'
import { notifyRunningEntriesRefresh } from '../../utils/runningEntriesSync'
import { TerminalActionButtons } from '../../components/terminal/TerminalActionButtons'
import { CashRegisterNumberModal } from '../../components/terminal/CashRegisterNumberModal'
import { TerminalResultMessage } from '../../components/terminal/TerminalResultMessage'
import { RunningStaffPanel } from '../../components/terminal/RunningStaffPanel'
import { ShiftCloseChecklistModal } from '../../components/terminal/ShiftCloseChecklistModal'
import { ShiftCloseSuccessCard } from '../../components/terminal/ShiftCloseSuccessCard'
import { Button } from '../../components/ui/Button'
import { addDays, startOfWeekMonday } from '../../components/schedule/scheduleWeekUtils'
import { toISODate } from '../../data/mockSchedule'
import type { ScheduleShift } from '../../data/mockSchedule'
import { getTaskStatusForDate, toISODateLocal } from '../../utils/taskUtils'
import type { Task } from '../../types/task'
import { TabletFuelPricesTab } from '../../components/terminal/TabletFuelPricesTab'
import { TabletRadioTab } from '../../components/terminal/TabletRadioTab'

type ModalMode = null | 'check-in' | 'check-out'

type ShiftWarningLite = { id: string; label: string; message: string }

type TabId = 'stamp' | 'schedule' | 'tasks' | 'fuel' | 'radio'

export function StaffTerminalPage() {
  const { stationId, selectedStation } = useStation()
  const {
    employees,
    timeEntries,
    shifts,
    workAreas,
    runningPresence,
    tasks,
    taskLogs,
    error,
    tabletToken,
    refetch,
    refetchTasks,
    completeShiftWithChecklist,
    completeTask,
    fetchFuelPrices,
    tabletRadio,
  } = useTabletTerminal()

  const [nowTick, setNowTick] = useState(() => new Date())
  const [tab, setTab] = useState<TabId>('stamp')

  const showRadioTab = Boolean(tabletToken && tabletRadio?.enabled)

  const terminalTabs = useMemo(() => {
    const base: [TabId, string][] = [
      ['stamp', 'Stempeln'],
      ['schedule', 'Schichtplan'],
      ['tasks', 'Aufgaben'],
      ['fuel', 'Spritpreise'],
    ]
    if (showRadioTab) base.push(['radio', 'Musik / Radio'])
    return base
  }, [showRadioTab])

  useEffect(() => {
    if (tab === 'radio' && !showRadioTab) setTab('stamp')
  }, [tab, showRadioTab])

  const [weekMonday, setWeekMonday] = useState(() => startOfWeekMonday(new Date()))
  const [taskConfirm, setTaskConfirm] = useState<{ task: Task; comment: string } | null>(null)

  const [modal, setModal] = useState<ModalMode>(null)
  const [checkInStep, setCheckInStep] = useState<CheckInEvaluation | null>(null)
  const lastCheckInCardRef = useRef('')
  const [checkInSecurity, setCheckInSecurity] = useState<{
    employeeId: string
    displayName: string
    plannedLabel: string
    force: boolean
  } | null>(null)
  const [checkoutSecurity, setCheckoutSecurity] = useState<{
    entry: TimeEntry
    displayName: string
  } | null>(null)
  const [checkOutMsg, setCheckOutMsg] = useState<CheckOutEvaluation | null>(null)
  const [checkOutEntry, setCheckOutEntry] = useState<TimeEntry | null>(null)
  const [inSuccess, setInSuccess] = useState<{ name: string; time: string } | null>(null)
  const [outSuccess, setOutSuccess] = useState<{ name: string; end: string; dur: string } | null>(null)
  const [pendingShiftWarnings, setPendingShiftWarnings] = useState<{
    employeeId: string
    note?: string
    force: boolean
    warnings: ShiftWarningLite[]
  } | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const startShiftForEmployee = useCallback(
    async (cardNumber: string, options?: { force?: boolean; startNote?: string }) => {
      const sid = stationId ?? DEFAULT_TABLET_STATION_ID
      const res = await fetch(`${API_BASE}/terminal/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: cardNumber.trim(),
          stationId: sid,
          force: Boolean(options?.force),
          ...(tabletToken ? { tabletToken } : {}),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        data?: { timeEntry?: TimeEntry }
        error?: string
        timeEntry?: TimeEntry
        result?: string
        warnings?: unknown
      }
      if (!json.ok) {
        if (json.result === 'shift_warnings_pending') {
          const err = new Error(json.error ?? 'Hinweis aus deiner letzten Schicht: Bitte zuerst bestätigen.')
          ;(err as Error & { code: string; warnings?: unknown }).code = 'shift_warnings_pending'
          ;(err as Error & { code: string; warnings?: unknown }).warnings = json.warnings
          throw err
        }
        throw new Error(json.error ?? 'Check-in fehlgeschlagen')
      }
      const entry = json.data?.timeEntry ?? json.timeEntry
      if (!entry) throw new Error('Keine Zeiterfassung in der Antwort')
      await refetch()
      notifyRunningEntriesRefresh()
      return entry
    },
    [refetch, stationId, tabletToken],
  )

  const shiftsInWeek = useMemo(() => {
    const mon = toISODate(weekMonday)
    const sun = toISODate(addDays(weekMonday, 6))
    return shifts.filter((s) => s.date >= mon && s.date <= sun)
  }, [shifts, weekMonday])

  const activeTaskEmployeeId = runningPresence[0]?.employeeId ?? null
  const activeTaskEmployeeName =
    employees.find((e) => e.id === activeTaskEmployeeId)?.displayName ?? runningPresence[0]?.displayName ?? null

  useEffect(() => {
    if (tab !== 'tasks') return
    void refetchTasks(activeTaskEmployeeId)
  }, [tab, activeTaskEmployeeId, refetchTasks])

  const workAreaLabel = useCallback(
    (id: string) => workAreas.find((w) => w.id === id)?.name ?? id,
    [workAreas],
  )

  const log = useCallback((_partial: Omit<CashRegisterCardEvent, 'id' | 'scannedAt' | 'stationId'>) => {
    void refetch()
  }, [refetch])

  const closeModal = () => {
    setModal(null)
    setCheckInStep(null)
    setCheckOutMsg(null)
    setCheckInSecurity(null)
    setCheckoutSecurity(null)
    setPendingShiftWarnings(null)
  }

  const acknowledgeShiftWarningsAndRetry = async () => {
    if (!pendingShiftWarnings || !stationId) return
    const card = lastCheckInCardRef.current.trim()
    if (!card) {
      window.alert('Kartennummer fehlt. Bitte erneut scannen.')
      return
    }
    for (const w of pendingShiftWarnings.warnings) {
      const res = await fetch(`${API_BASE}/terminal/shift-warnings/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: card,
          stationId,
          warningId: w.id,
          ...(tabletToken ? { tabletToken } : {}),
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        window.alert(json.error ?? 'Hinweis konnte nicht bestätigt werden')
        return
      }
    }
    const { employeeId, note, force } = pendingShiftWarnings
    setPendingShiftWarnings(null)
    await finalizeCheckIn(employeeId, note, force)
  }

  const finalizeCheckIn = async (employeeId: string, note?: string, force = false) => {
    const card = lastCheckInCardRef.current.trim()
    if (!card) {
      window.alert('Kartennummer fehlt. Bitte erneut scannen.')
      return
    }
    try {
      const entry = await startShiftForEmployee(card, { force, startNote: note })
      const emp = employees.find((e) => e.id === employeeId)
      const t = new Date(entry.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      setCheckInStep(null)
      setModal(null)
      setCheckInSecurity(null)
      setInSuccess({ name: emp?.displayName ?? 'Mitarbeiter', time: t })
      void refetchTasks(employeeId)
      setTab('tasks')
      window.setTimeout(() => setInSuccess(null), 28_000)
      log({
        cardNumber: emp?.cashRegisterCardNumber ?? card,
        employeeId,
        actionType: 'check_in',
        result: 'success',
        message: `Schicht gestartet ${t}`,
      })
    } catch (err) {
      const e = err as Error & { code?: string; warnings?: unknown }
      if (e?.code === 'shift_warnings_pending') {
        const raw = e.warnings
        const warnings: ShiftWarningLite[] = Array.isArray(raw)
          ? (raw as Record<string, unknown>[])
              .map((o) => ({
                id: String(o.id ?? ''),
                label: String(o.label ?? 'Hinweis'),
                message: typeof o.message === 'string' ? o.message : String(o.message ?? ''),
              }))
              .filter((w) => w.id)
          : []
        setPendingShiftWarnings({ employeeId, note, force, warnings })
        return
      }
      window.alert(err instanceof Error ? err.message : 'Check-in fehlgeschlagen')
    }
  }

  const onCardSubmit = (card: string) => {
    setCheckOutMsg(null)
    if (modal === 'check-in') {
      lastCheckInCardRef.current = card
      const ev = evaluateCheckIn(card, employees, shifts, timeEntries, new Date())
      if (ev.kind === 'unknown_card') {
        log({ cardNumber: card, actionType: 'check_in', result: 'unknown_card', message: 'Unbekannte Karte' })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'already_checked_in') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'already_checked_in',
          message: 'Bereits eingestempelt',
        })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'not_scheduled') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'not_scheduled',
          message: 'Nicht geplant',
        })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'too_early') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'too_early',
          message: `${ev.minutesEarly} Min. zu früh`,
        })
        setCheckInStep(ev)
        return
      }
      if (ev.kind === 'ready') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'success',
          message: 'Check-in (Bestätigung)',
        })
        setModal(null)
        setCheckInStep(null)
        setCheckInSecurity({
          employeeId: ev.employee.id,
          displayName: ev.employee.displayName,
          plannedLabel: ev.planned ? `${ev.planned.startTime} – ${ev.planned.endTime}` : '—',
          force: false,
        })
        return
      }
      if (ev.kind === 'too_late') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_in',
          result: 'too_late',
          message: `${ev.minutesLate} Min. zu spät`,
        })
        setCheckInStep(ev)
        return
      }
    }

    if (modal === 'check-out') {
      const ev = evaluateCheckOut(card, employees, timeEntries)
      if (ev.kind === 'unknown_card') {
        log({ cardNumber: card, actionType: 'check_out', result: 'unknown_card', message: 'Unbekannte Karte' })
        setCheckOutMsg(ev)
        return
      }
      if (ev.kind === 'not_checked_in') {
        log({
          cardNumber: card,
          employeeId: ev.employee.id,
          actionType: 'check_out',
          result: 'not_checked_in',
          message: 'Keine laufende Schicht',
        })
        setCheckOutMsg(ev)
        return
      }
      setModal(null)
      setCheckoutSecurity({
        entry: ev.entry,
        displayName: ev.employee.displayName,
      })
      log({
        cardNumber: card,
        employeeId: ev.employee.id,
        actionType: 'check_out',
        result: 'checklist_required',
        message: 'Checkliste',
      })
    }
  }

  const renderCheckInFollowUp = () => {
    if (!checkInStep) return null
    if (checkInStep.kind === 'unknown_card') {
      return (
        <TerminalResultMessage
          variant="error"
          title="Kassenkartennummer nicht bekannt"
          message="Bitte wende dich an den Teamleiter."
        />
      )
    }
    if (checkInStep.kind === 'already_checked_in') {
      const t = new Date(checkInStep.entry.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      return (
        <TerminalResultMessage
          variant="warning"
          title="Du bist bereits eingestempelt."
          message={`Deine Schicht läuft seit ${t} Uhr.`}
        />
      )
    }
    if (checkInStep.kind === 'not_scheduled') {
      return (
        <TerminalResultMessage
          variant="warning"
          title="Für dich ist heute keine Schicht geplant."
          message={`${checkInStep.employee.displayName} — du kannst trotzdem starten oder abbrechen.`}
        >
          <Button variant="primary" type="button" onClick={() => void finalizeCheckIn(checkInStep.employee.id, 'Nicht geplant — trotzdem gestartet', true)}>
            Trotzdem Schicht starten
          </Button>
          <Button variant="ghost" type="button" onClick={() => setCheckInStep(null)}>
            Abbrechen
          </Button>
        </TerminalResultMessage>
      )
    }
    if (checkInStep.kind === 'too_early') {
      return (
        <TerminalResultMessage
          variant="warning"
          title="Zu früh"
          message={`Deine geplante Schicht beginnt erst um ${checkInStep.plannedStart} Uhr. Du bist ${checkInStep.minutesEarly} Minuten zu früh.`}
        >
          <Button variant="primary" type="button" onClick={() => void finalizeCheckIn(checkInStep.employee.id, 'Zu früh — trotzdem gestartet', true)}>
            Trotzdem Schicht starten
          </Button>
          <Button variant="ghost" type="button" onClick={() => setCheckInStep(null)}>
            Abbrechen
          </Button>
        </TerminalResultMessage>
      )
    }
    if (checkInStep.kind === 'too_late') {
      return (
        <TerminalResultMessage
          variant="warning"
          title="Verspäteter Start"
          message={`Deine geplante Schicht hat um ${checkInStep.planned.startTime} Uhr begonnen. Du startest ${checkInStep.minutesLate} Minuten später.`}
        >
          <Button variant="primary" type="button" onClick={() => void finalizeCheckIn(checkInStep.employee.id, `Zu spät: ${checkInStep.minutesLate} Min.`, true)}>
            Schicht trotzdem starten
          </Button>
          <Button variant="ghost" type="button" onClick={() => setCheckInStep(null)}>
            Abbrechen
          </Button>
        </TerminalResultMessage>
      )
    }
    return null
  }

  const renderCheckOutMsg = () => {
    if (!checkOutMsg) return null
    if (checkOutMsg.kind === 'unknown_card') {
      return (
        <TerminalResultMessage variant="error" title="Kartennummer unbekannt" message="Bitte wende dich an den Teamleiter." />
      )
    }
    if (checkOutMsg.kind === 'not_checked_in') {
      return (
        <TerminalResultMessage
          variant="error"
          title="Nicht eingestempelt"
          message="Du bist aktuell nicht eingestempelt."
        />
      )
    }
    return null
  }

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pb-12 pt-8 sm:pt-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400/80">Rabbit-Technik</p>
      <h1 className="mt-1 text-2xl font-bold text-[var(--text-main)] sm:text-3xl md:text-4xl">
        {selectedStation?.name ?? 'Station'}
      </h1>
      <p className="mt-1 text-base text-cyan-200/90 sm:text-lg">Mitarbeiter-Terminal</p>
      <p className="mt-4 text-4xl font-semibold tabular-nums text-cyan-50 sm:text-5xl">
        {nowTick.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr
      </p>
      <p className="mt-2 text-center text-lg capitalize text-[var(--text-muted)]">
        {nowTick.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
      </p>

      <nav className="mt-8 flex w-full max-w-4xl flex-wrap justify-center gap-3">
        {terminalTabs.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? 'primary' : 'ghost'}
            className="min-h-[52px] min-w-[140px] rounded-xl text-base font-semibold"
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {error ? (
        <p className="mt-6 max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-red-100">
          {error}
        </p>
      ) : null}

      {tab === 'stamp' ? (
        <>
          <p className="mt-10 text-center text-lg text-[var(--text-muted)] sm:text-xl">Bitte wähle eine Aktion.</p>

          <div className="mt-8 flex w-full max-w-4xl justify-center">
            <TerminalActionButtons
              onCheckIn={() => {
                setCheckInStep(null)
                setCheckOutMsg(null)
                setInSuccess(null)
                setCheckInSecurity(null)
                setCheckoutSecurity(null)
                setPendingShiftWarnings(null)
                setModal('check-in')
              }}
              onCheckOut={() => {
                setCheckInStep(null)
                setCheckOutMsg(null)
                setCheckInSecurity(null)
                setCheckoutSecurity(null)
                setPendingShiftWarnings(null)
                setModal('check-out')
              }}
            />
          </div>

          <RunningStaffPanel rows={runningPresence} />

          <div className="mt-10 w-full max-w-3xl space-y-4">
            {inSuccess ? (
              <TerminalResultMessage
                variant="success"
                title={`Hallo, ${inSuccess.name}`}
                message={`Deine Schicht wurde um ${inSuccess.time} Uhr gestartet.`}
              >
                <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto text-left text-sm text-[var(--text-muted)]">
                  <p className="font-medium text-emerald-100">Aufgaben für heute</p>
                  {tasks.length === 0 ? (
                    <p>
                      Du hast heute keine extra Aufgaben. Bitte beachte deinen normalen Arbeitsablauf und den Schlusscheck zum
                      Feierabend.
                    </p>
                  ) : (
                    <ul className="list-inside list-disc space-y-1">
                      {tasks.slice(0, 12).map((t) => (
                        <li key={t.id}>{t.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button variant="ghost" type="button" onClick={() => setInSuccess(null)}>
                  Schließen
                </Button>
              </TerminalResultMessage>
            ) : null}
            {renderCheckInFollowUp()}
            {renderCheckOutMsg()}
          </div>
        </>
      ) : null}

      {tab === 'schedule' ? (
        <div className="mt-8 w-full max-w-5xl">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setWeekMonday(addDays(weekMonday, -7))}>
              ← Vorherige Woche
            </Button>
            <Button type="button" variant="primary" onClick={() => setWeekMonday(startOfWeekMonday(new Date()))}>
              Heute
            </Button>
            <Button type="button" variant="ghost" onClick={() => setWeekMonday(addDays(weekMonday, 7))}>
              Nächste Woche →
            </Button>
          </div>
          <p className="mt-4 text-center text-[var(--text-muted)]">Woche ab {toISODate(weekMonday)} (Lesemodus)</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5, 6].map((off) => {
              const d = addDays(weekMonday, off)
              const iso = toISODate(d)
              const dayShifts = shiftsInWeek.filter((s) => s.date === iso)
              const label = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })
              return (
                <div key={iso} className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="font-semibold capitalize text-cyan-100">{label}</p>
                  {dayShifts.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--text-faint)]">Keine Schichten</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {dayShifts.map((s: ScheduleShift) => (
                        <li key={s.id} className="rounded-lg border border-white/10 p-2">
                          <p className="font-medium" style={{ color: s.employeeColor ?? '#94a3b8' }}>
                            {s.employeeDisplayName ?? '—'}
                          </p>
                          <p className="text-[var(--text-muted)]">
                            {s.startTime} – {s.endTime} · {workAreaLabel(s.workAreaId)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className="mx-auto mt-8 w-full max-w-4xl px-2">
          <h2 className="text-center text-xl font-semibold text-[var(--text-main)] sm:text-2xl">
            {activeTaskEmployeeName ? `Aufgaben für ${activeTaskEmployeeName} heute` : 'Aufgaben'}
          </h2>
          {!activeTaskEmployeeId ? (
            <p className="mt-4 text-center text-[var(--text-muted)]">
              Bitte zuerst einstempeln oder Mitarbeiter auswählen.
            </p>
          ) : null}
          {tasks.length === 0 ? (
            <p className="mt-6 text-center text-[var(--text-muted)]">
              Du hast heute keine extra Aufgaben. Bitte beachte deinen normalen Arbeitsablauf und den Schlusscheck zum Feierabend.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {tasks.map((t) => {
                const st = getTaskStatusForDate(t, taskLogs, toISODateLocal(new Date()))
                const done = st === 'erledigt' || st === 'kontrolliert'
                return (
                  <li
                    key={t.id}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div>
                      <p className="text-lg font-semibold text-[var(--text-main)]">{t.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {t.startTime}–{t.endTime} · {workAreaLabel(t.workAreaId)} · Pflicht: {t.mandatory ? 'ja' : 'nein'}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-faint)]">Status: {st ?? '—'}</p>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      className="mt-3 shrink-0 sm:mt-0"
                      disabled={!activeTaskEmployeeId || done}
                      onClick={() => setTaskConfirm({ task: t, comment: '' })}
                    >
                      Erledigt markieren
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'fuel' ? <TabletFuelPricesTab fetchFuelPrices={fetchFuelPrices} /> : null}

      {tab === 'radio' && showRadioTab && tabletRadio ? <TabletRadioTab config={tabletRadio} /> : null}

      {taskConfirm ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/35 bg-[var(--bg-card)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Aufgabe erledigt?</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Bestätigst du, dass du diese Aufgabe erledigt hast?</p>
            <p className="mt-3 text-sm font-medium text-cyan-100">{taskConfirm.task.title}</p>
            <label className="mt-4 block text-sm text-[var(--text-muted)]">
              Bemerkung (optional)
              <textarea
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
                rows={3}
                value={taskConfirm.comment}
                onChange={(e) => setTaskConfirm({ ...taskConfirm, comment: e.target.value })}
              />
            </label>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setTaskConfirm(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => {
                  void (async () => {
                    if (!activeTaskEmployeeId || !activeTaskEmployeeName) {
                      window.alert('Bitte zuerst einstempeln.')
                      return
                    }
                    try {
                      await completeTask(taskConfirm.task.id, {
                        date: toISODateLocal(new Date()),
                        employeeId: activeTaskEmployeeId,
                        displayName: activeTaskEmployeeName,
                        comment: taskConfirm.comment.trim() || undefined,
                      })
                      setTaskConfirm(null)
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
                    }
                  })()
                }}
              >
                Bestätigen
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {checkInSecurity ? (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/35 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(52,211,153,0.15)]">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Schicht wirklich starten?</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Möchtest du dich wirklich zur Schicht anmelden?</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--text-main)]">
              <p>
                <span className="text-[var(--text-faint)]">Mitarbeiter:</span> {checkInSecurity.displayName}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Geplante Schicht:</span> {checkInSecurity.plannedLabel}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Aktuelle Uhrzeit:</span>{' '}
                {nowTick.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setCheckInSecurity(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => void finalizeCheckIn(checkInSecurity.employeeId, undefined, checkInSecurity.force)}
              >
                Ja, Schicht starten
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {checkoutSecurity ? (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-orange-400/35 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(251,146,60,0.12)]">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Schicht wirklich beenden?</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Möchtest du deine Schicht jetzt wirklich beenden?</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--text-main)]">
              <p>
                <span className="text-[var(--text-faint)]">Mitarbeiter:</span> {checkoutSecurity.displayName}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Startzeit:</span>{' '}
                {new Date(checkoutSecurity.entry.startAt).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                Uhr
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Bisherige Arbeitszeit:</span>{' '}
                {formatWorkedDuration(calculateWorkedMinutes(checkoutSecurity.entry.startAt, undefined, new Date()))}
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Aktuelle Uhrzeit:</span>{' '}
                {nowTick.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setCheckoutSecurity(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setCheckOutEntry(checkoutSecurity.entry)
                  setCheckoutSecurity(null)
                }}
              >
                Ja, Schicht beenden
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingShiftWarnings ? (
        <div className="fixed inset-0 z-[138] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-amber-400/35 bg-[var(--bg-card)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Hinweis aus deiner letzten Schicht</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Bitte bestätige die folgenden Hinweise der Leitung, bevor du dich erneut einstempelst.
            </p>
            <ul className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto text-sm">
              {pendingShiftWarnings.warnings.map((w) => (
                <li key={w.id} className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                  <p className="font-medium text-amber-100">{w.label}</p>
                  {w.message ? <p className="mt-1 text-[var(--text-muted)]">{w.message}</p> : null}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setPendingShiftWarnings(null)}>
                Später
              </Button>
              <Button type="button" variant="primary" className="flex-1" onClick={() => void acknowledgeShiftWarningsAndRetry()}>
                Verstanden, fortfahren
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <CashRegisterNumberModal open={modal !== null} mode={modal === 'check-out' ? 'check-out' : 'check-in'} onClose={closeModal} onSubmit={onCardSubmit} />

      {checkOutEntry ? (
        <ShiftCloseChecklistModal
          open
          employeeName={employees.find((e) => e.id === checkOutEntry.employeeId)?.displayName ?? 'Mitarbeiter'}
          timeEntryId={checkOutEntry.id}
          employeeId={checkOutEntry.employeeId}
          onClose={() => setCheckOutEntry(null)}
          onComplete={async (checklist) => {
            const end = new Date().toISOString()
            try {
              await completeShiftWithChecklist(checkOutEntry.id, checklist)
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Ausstempeln fehlgeschlagen')
              return
            }
            const mins = calculateWorkedMinutes(checkOutEntry.startAt, end, new Date())
            const name = employees.find((e) => e.id === checkOutEntry.employeeId)?.displayName ?? ''
            const endLabel = new Date(end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            setCheckOutEntry(null)
            setOutSuccess({ name, end: endLabel, dur: formatWorkedDuration(mins) })
            log({
              cardNumber: employees.find((e) => e.id === checkOutEntry.employeeId)?.cashRegisterCardNumber ?? '',
              employeeId: checkOutEntry.employeeId,
              actionType: 'check_out',
              result: 'success',
              message: 'Schicht beendet',
            })
          }}
        />
      ) : null}

      {outSuccess ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <ShiftCloseSuccessCard
            employeeName={outSuccess.name}
            endTimeLabel={outSuccess.end}
            durationLabel={outSuccess.dur}
            onDismiss={() => setOutSuccess(null)}
          />
        </div>
      ) : null}
    </div>
  )
}
