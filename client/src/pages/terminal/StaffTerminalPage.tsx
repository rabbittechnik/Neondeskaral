import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStation } from '../../context/station-context'
import { useTabletTerminal, tabletGet, type TabletRunningRow } from '../../context/tablet-terminal-context'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../utils/timeTrackingUtils'
import type { TimeEntry } from '../../types/timeTracking'
import type { CashRegisterCardEvent } from '../../types/timeTracking'
import { API_BASE } from '../../services/api'
import { DEFAULT_TABLET_STATION_ID } from '../../data/station'
import { notifyRunningEntriesRefresh } from '../../utils/runningEntriesSync'
import { TerminalActionButtons } from '../../components/terminal/TerminalActionButtons'
import { TerminalEmployeePickModal } from '../../components/terminal/TerminalEmployeePickModal'
import { TerminalResultMessage } from '../../components/terminal/TerminalResultMessage'
import { RunningStaffPanel } from '../../components/terminal/RunningStaffPanel'
import { ShiftCloseChecklistModal, type ShiftCloseCatalogItem, type ShiftCloseWizardGroup, type ShiftCloseTaskCloseDeclaration } from '../../components/terminal/ShiftCloseChecklistModal'
import { normalizeShiftCloseCatalogItems, parseShiftCloseWizardGroups } from '../../utils/shiftCloseChecklistClient'
import { ShiftCloseSuccessCard } from '../../components/terminal/ShiftCloseSuccessCard'
import { Button } from '../../components/ui/Button'
import { BakingNoticeModal, type BakingNoticePayload } from '../../components/baking/BakingNoticeModal'
import { addDays, startOfWeekMonday } from '../../components/schedule/scheduleWeekUtils'
import { toISODate } from '../../data/mockSchedule'
import type { ScheduleShift } from '../../data/mockSchedule'
import { getTaskStatusForDate, taskDisplayTimingLine, toISODateLocal } from '../../utils/taskUtils'
import type { Task } from '../../types/task'
import { TabletFuelPricesTab } from '../../components/terminal/TabletFuelPricesTab'
import { TabletRadioTab } from '../../components/terminal/TabletRadioTab'
import { TabletRadioMiniPlayer } from '../../components/terminal/TabletRadioMiniPlayer'
import { TabletPwaUpdateControls } from '../../components/terminal/TabletPwaUpdateControls'
import type { TabletCheckInSuggestionsPayload } from '../../types/tabletCheckInSuggestions'

type ModalMode = null | 'check-in' | 'check-out'

type ShiftWarningLite = { id: string; label: string; message: string }

type CheckInApiConfirm = {
  employeeId: string
  shiftId?: string
  result: string
  reason?: string
  message: string
  plannedStart?: string | null
  plannedEnd?: string | null
  plannedStartAt?: string
  plannedEndAt?: string
  displayText?: string
  actualStart?: string
  deviationMinutes?: number | null
}

function formatHmDurationDe(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  if (m < 60) return `${m} Min.`
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (mm === 0) return `${h} Std.`
  return `${h} Std. ${mm} Min.`
}

function formatCheckInDeviationFallback(reason: 'early' | 'late', deviationMinutes: number): string {
  const core = formatHmDurationDe(deviationMinutes)
  return reason === 'early' ? `${core} früher` : `${core} später`
}

type CheckoutEndConfirm = {
  timeEntryId: string
  employeeId: string
  displayName: string
  startAt: string
  checklist: Record<string, unknown>
  taskCloseDeclarations?: ShiftCloseTaskCloseDeclaration[]
  taskCloseAccuracyConfirmed?: boolean
  plannedEnd: string
  actualEnd: string
  deviationMinutes: number
  /** Server: `early_end` | `late_end` */
  endDeviationReason?: string
  message: string
}

/** Anzeige „seit 07:29 Uhr“ für Tablet-Anwesenheit (lokale Uhrzeit). */
function formatSinceClockDe(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/** Erste heutige Schicht-ID für Plan-Verknüpfung (wenn kein Vorschlags-shiftId). */
function firstShiftIdTodayForEmployee(shifts: ScheduleShift[], employeeId: string, todayYmd: string): string | undefined {
  const list = shifts.filter(
    (s) =>
      s.employeeId === employeeId &&
      s.date === todayYmd &&
      s.shiftType !== 'frei' &&
      Boolean(s.startTime) &&
      Boolean(s.endTime),
  )
  list.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
  return list[0]?.id
}

type TabId = 'stamp' | 'schedule' | 'tasks' | 'fuel' | 'radio'

export function StaffTerminalPage() {
  const { stationId, selectedStation } = useStation()
  const {
    employees,
    shifts,
    workAreas,
    runningPresence,
    tasksByEmployee,
    error,
    tabletToken,
    refetch,
    refetchRunning,
    syncTabletRunningAndTasks,
    refetchTasksForRunning,
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
  const [taskConfirm, setTaskConfirm] = useState<{
    task: Task
    comment: string
    employeeId: string
    displayName: string
  } | null>(null)

  const [modal, setModal] = useState<ModalMode>(null)
  const [checkInApiConfirm, setCheckInApiConfirm] = useState<CheckInApiConfirm | null>(null)
  const lastCheckInCardRef = useRef('')
  const [checkOutErr, setCheckOutErr] = useState<string | null>(null)
  const [checkOutEntry, setCheckOutEntry] = useState<TimeEntry | null>(null)
  const [checkoutCatalog, setCheckoutCatalog] = useState<{
    checklistType: 'handover' | 'closing'
    items: ShiftCloseCatalogItem[]
    wizardGroups?: ShiftCloseWizardGroup[]
  } | null>(null)
  const [checkoutBlockingTasks, setCheckoutBlockingTasks] = useState<Task[]>([])
  const [checkoutHandoverUiMode, setCheckoutHandoverUiMode] = useState<'midday_standard_collective' | undefined>(undefined)
  const [checkoutMiddayBullets, setCheckoutMiddayBullets] = useState<string[]>([])
  const [inSuccess, setInSuccess] = useState<{ name: string; time: string; employeeId: string } | null>(null)
  const [outSuccess, setOutSuccess] = useState<{ name: string; end: string; dur: string } | null>(null)
  const [checkoutEndConfirm, setCheckoutEndConfirm] = useState<CheckoutEndConfirm | null>(null)
  const [checkoutStartBusy, setCheckoutStartBusy] = useState(false)
  const [pendingShiftWarnings, setPendingShiftWarnings] = useState<{
    employeeId: string
    shiftId?: string
    note?: string
    force: boolean
    warnings: ShiftWarningLite[]
  } | null>(null)

  const [checkInSuggestionsPayload, setCheckInSuggestionsPayload] = useState<TabletCheckInSuggestionsPayload | null>(null)
  const [checkInSugLoading, setCheckInSugLoading] = useState(false)
  const [checkInSugErr, setCheckInSugErr] = useState<string | null>(null)
  const [checkInSubmitting, setCheckInSubmitting] = useState(false)
  const [checkInSubmitError, setCheckInSubmitError] = useState<string | null>(null)
  const [terminalBakingNotice, setTerminalBakingNotice] = useState<BakingNoticePayload | null>(null)
  const [terminalBakingOpen, setTerminalBakingOpen] = useState(false)
  const [terminalBakingBusy, setTerminalBakingBusy] = useState(false)

  const tabletStationQuery = useMemo((): Record<string, string> => {
    const t = tabletToken?.trim()
    if (t) return { tabletToken: t }
    if (stationId) return { stationId }
    return {}
  }, [tabletToken, stationId])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (modal !== 'check-in') {
      setCheckInSuggestionsPayload(null)
      setCheckInSugErr(null)
      setCheckInSugLoading(false)
      return
    }
    const q = tabletStationQuery
    if (!Object.keys(q).length) {
      setCheckInSuggestionsPayload(null)
      setCheckInSugErr(null)
      setCheckInSugLoading(false)
      return
    }
    let cancelled = false
    setCheckInSugLoading(true)
    setCheckInSugErr(null)
    void (async () => {
      const res = await tabletGet<TabletCheckInSuggestionsPayload>('/tablet/check-in-suggestions', q)
      if (cancelled) return
      setCheckInSugLoading(false)
      if (!res.ok) {
        setCheckInSugErr(res.error)
        setCheckInSuggestionsPayload(null)
        return
      }
      setCheckInSuggestionsPayload(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [modal, tabletStationQuery])

  useEffect(() => {
    if (!checkInApiConfirm) return
    const p = checkInApiConfirm
    const employeeName = employees.find((e) => e.id === p.employeeId)?.displayName
    console.log('shift start deviation popup', {
      employeeName,
      plannedStartAt: p.plannedStartAt,
      plannedEndAt: p.plannedEndAt,
      actualStartAt: p.actualStart,
      timezone: 'Europe/Berlin',
      deviationMinutes: p.deviationMinutes,
      reason: p.reason,
      displayText: p.displayText,
    })
  }, [checkInApiConfirm, employees])

  const startShiftByEmployeeId = useCallback(
    async (employeeId: string, force: boolean, shiftId?: string) => {
      const fallbackStation = stationId ?? DEFAULT_TABLET_STATION_ID
      const tt = tabletToken?.trim()
      const body: Record<string, unknown> = {
        employeeId,
        force,
        ...(shiftId ? { shiftId } : {}),
      }
      if (tt) body.tabletToken = tt
      else body.stationId = fallbackStation

      let res: Response
      try {
        res = await fetch(`${API_BASE}/terminal/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {
        throw new Error('Server nicht erreichbar. Bitte Verbindung prüfen.')
      }
      let json: Record<string, unknown> = {}
      try {
        json = (await res.json()) as Record<string, unknown>
      } catch {
        throw new Error('Server nicht erreichbar. Bitte Verbindung prüfen.')
      }
      console.log('[terminal] check-in response', {
        httpOk: res.ok,
        jsonOk: json.ok,
        result: json.result,
        requiresConfirmation: json.requiresConfirmation,
      })
      if (!res.ok) {
        throw new Error(String(json.error ?? `Serverfehler (${res.status})`))
      }
      if (json.ok === false) {
        if (json.result === 'shift_warnings_pending') {
          const err = new Error(String(json.error ?? 'Hinweis aus deiner letzten Schicht: Bitte zuerst bestätigen.')) as Error & {
            code: string
            warnings?: unknown
          }
          err.code = 'shift_warnings_pending'
          err.warnings = json.warnings
          throw err
        }
        if (json.requiresConfirmation === true) {
          return {
            needsConfirm: true as const,
            employeeId,
            result: String(json.result ?? ''),
            reason: typeof json.reason === 'string' ? json.reason : undefined,
            message: String(json.error ?? json.message ?? ''),
            plannedStart: json.plannedStart as string | null | undefined,
            plannedEnd: typeof json.plannedEnd === 'string' ? json.plannedEnd : undefined,
            plannedStartAt: typeof json.plannedStartAt === 'string' ? json.plannedStartAt : undefined,
            plannedEndAt: typeof json.plannedEndAt === 'string' ? json.plannedEndAt : undefined,
            displayText: typeof json.displayText === 'string' ? json.displayText : undefined,
            actualStart: typeof json.actualStart === 'string' ? json.actualStart : undefined,
            deviationMinutes:
              typeof json.deviationMinutes === 'number'
                ? json.deviationMinutes
                : json.deviationMinutes === null
                  ? null
                  : undefined,
          }
        }
        throw new Error(String(json.error ?? 'Fehler beim Starten der Schicht.'))
      }
      if (json.ok === true && json.data && typeof json.data === 'object') {
        const data = json.data as { timeEntry?: TimeEntry; bakingNotice?: BakingNoticePayload }
        const entry = data.timeEntry
        if (!entry) throw new Error('Keine Zeiterfassung in der Antwort')
        await refetch()
        void refetchRunning()
        notifyRunningEntriesRefresh()
        return { ok: true as const, entry, bakingNotice: data.bakingNotice }
      }
      throw new Error(String(json.error ?? 'Ungültige Server-Antwort'))
    },
    [refetch, refetchRunning, stationId, tabletToken],
  )

  const shiftsInWeek = useMemo(() => {
    const mon = toISODate(weekMonday)
    const sun = toISODate(addDays(weekMonday, 6))
    return shifts.filter((s) => s.date >= mon && s.date <= sun)
  }, [shifts, weekMonday])

  const resolveShiftIdForCheckIn = useCallback(
    (employeeId: string, explicitShiftId?: string) => {
      const ex = explicitShiftId?.trim()
      if (ex) return ex
      return firstShiftIdTodayForEmployee(shifts, employeeId, toISODateLocal(new Date()))
    },
    [shifts],
  )

  const sortedPresenceForTasks = useMemo(() => {
    return [...runningPresence].sort(
      (a, b) => a.startAt.localeCompare(b.startAt) || a.displayName.localeCompare(b.displayName, 'de'),
    )
  }, [runningPresence])

  useEffect(() => {
    if (tab !== 'tasks') return
    void syncTabletRunningAndTasks()
  }, [tab, syncTabletRunningAndTasks])

  useEffect(() => {
    if (tab !== 'tasks') return
    void refetchTasksForRunning(runningPresence)
  }, [runningPresence, tab, refetchTasksForRunning])

  const runningPresenceTasksRef = useRef<TabletRunningRow[]>(runningPresence)
  runningPresenceTasksRef.current = runningPresence

  useEffect(() => {
    if (tab !== 'tasks') return
    const id = window.setInterval(() => void refetchTasksForRunning(runningPresenceTasksRef.current), 30_000)
    return () => window.clearInterval(id)
  }, [tab, refetchTasksForRunning])

  const workAreaLabel = useCallback(
    (id: string) => workAreas.find((w) => w.id === id)?.name ?? id,
    [workAreas],
  )

  const log = useCallback((_partial: Omit<CashRegisterCardEvent, 'id' | 'scannedAt' | 'stationId'>) => {
    void refetch()
  }, [refetch])

  const closeModal = () => {
    setModal(null)
    setCheckInApiConfirm(null)
    setCheckOutErr(null)
    setCheckOutEntry(null)
    setCheckoutCatalog(null)
    setCheckoutBlockingTasks([])
    setCheckoutHandoverUiMode(undefined)
    setCheckoutMiddayBullets([])
    setPendingShiftWarnings(null)
    setCheckoutEndConfirm(null)
    setCheckInSuggestionsPayload(null)
    setCheckInSugErr(null)
    setCheckInSugLoading(false)
    setCheckInSubmitting(false)
    setCheckInSubmitError(null)
  }

  const acknowledgeShiftWarningsAndRetry = async () => {
    if (!pendingShiftWarnings) return
    const sid = stationId ?? DEFAULT_TABLET_STATION_ID
    const empId = pendingShiftWarnings.employeeId.trim()
    const card = lastCheckInCardRef.current.trim()
    for (const w of pendingShiftWarnings.warnings) {
      const res = await fetch(`${API_BASE}/terminal/shift-warnings/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: sid,
          warningId: w.id,
          ...(tabletToken ? { tabletToken } : {}),
          ...(card ? { cardNumber: card } : { employeeId: empId }),
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!json.ok) {
        window.alert(json.error ?? 'Hinweis konnte nicht bestätigt werden')
        return
      }
    }
    const { employeeId, force, shiftId } = pendingShiftWarnings
    setPendingShiftWarnings(null)
    await finalizeCheckInByEmployee(employeeId, force, shiftId)
  }

  const finalizeCheckInByEmployee = async (employeeId: string, force = false, shiftId?: string) => {
    const empTrim = employeeId.trim()
    if (!empTrim) {
      setCheckInSubmitError('Bitte Mitarbeiter auswählen.')
      window.alert('Bitte Mitarbeiter auswählen.')
      return
    }
    const effectiveShiftId = resolveShiftIdForCheckIn(empTrim, shiftId)
    console.log('[terminal] start shift clicked', {
      employeeId: empTrim,
      shiftId: effectiveShiftId,
      force,
      stationScope: tabletToken?.trim() ? 'tabletToken' : 'stationId',
      stationId: tabletToken?.trim() ? undefined : stationId ?? DEFAULT_TABLET_STATION_ID,
      hasTabletToken: Boolean(tabletToken?.trim()),
    })
    setCheckInSubmitError(null)
    setCheckInSubmitting(true)
    try {
      const out = await startShiftByEmployeeId(empTrim, force, effectiveShiftId)
      if ('needsConfirm' in out && out.needsConfirm) {
        setModal(null)
        setCheckInApiConfirm({
          employeeId: out.employeeId,
          shiftId: effectiveShiftId,
          result: out.result,
          reason: out.reason,
          message: out.message,
          plannedStart: out.plannedStart ?? null,
          plannedEnd: out.plannedEnd,
          plannedStartAt: out.plannedStartAt,
          plannedEndAt: out.plannedEndAt,
          displayText: out.displayText,
          actualStart: out.actualStart,
          deviationMinutes: out.deviationMinutes ?? null,
        })
        return
      }
      const entry = out.entry
      const emp = employees.find((e) => e.id === empTrim)
      const t = new Date(entry.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      setCheckInApiConfirm(null)
      setModal(null)
      setInSuccess({ name: emp?.displayName ?? 'Mitarbeiter', time: t, employeeId: empTrim })
      if (out.bakingNotice?.timeEntryId && ((out.bakingNotice.items?.length ?? 0) > 0 || out.bakingNotice.routineId)) {
        const bn = out.bakingNotice
        setTerminalBakingNotice({
          timeEntryId: bn.timeEntryId,
          routineType: bn.routineType ?? 'weekday',
          routineId: bn.routineId ?? null,
          title: bn.title ?? 'Backwaren',
          items: Array.isArray(bn.items) ? bn.items : [],
          itemSnapshots: Array.isArray(bn.itemSnapshots)
            ? bn.itemSnapshots
            : (Array.isArray(bn.items) ? bn.items : []).map((line) => ({
                itemId: null,
                name: '',
                quantity: 0,
                unit: 'Stück',
                category: null,
                line,
              })),
        })
        setTerminalBakingOpen(true)
      } else {
        setTerminalBakingNotice(null)
        setTerminalBakingOpen(false)
      }
      void refetchRunning()
      setTab('tasks')
      window.setTimeout(() => setInSuccess(null), 28_000)
      log({
        cardNumber: String(emp?.cashRegisterCardNumber ?? '').trim(),
        employeeId: empTrim,
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
        setModal(null)
        setPendingShiftWarnings({ employeeId: empTrim, force, shiftId: effectiveShiftId, warnings })
        return
      }
      const msg = err instanceof Error ? err.message : 'Check-in fehlgeschlagen'
      setCheckInSubmitError(msg)
      window.alert(msg)
    } finally {
      setCheckInSubmitting(false)
    }
  }

  const startCheckoutChecklistForEmployee = async (employeeId: string) => {
    const sid = stationId ?? DEFAULT_TABLET_STATION_ID
    setCheckoutStartBusy(true)
    setCheckOutErr(null)
    try {
      const res = await fetch(`${API_BASE}/terminal/check-out-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          stationId: sid,
          ...(tabletToken ? { tabletToken } : {}),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        data?: {
          timeEntry?: TimeEntry
          checklistType?: string
          items?: unknown[]
          wizardGroups?: unknown
          blockingTasks?: Task[]
          handoverUiMode?: string
          middayHandoverBullets?: string[]
        }
        error?: string
      }
      if (!json.ok || !json.data?.timeEntry) {
        setCheckOutErr(json.error ?? 'Auscheck konnte nicht gestartet werden.')
        return
      }
      const { checklistType, items, wizardGroups, blockingTasks: blockingRaw, handoverUiMode, middayHandoverBullets } =
        json.data
      const blockingTasks = Array.isArray(blockingRaw) ? blockingRaw : []
      const normalizedItems = Array.isArray(items) ? normalizeShiftCloseCatalogItems(items) : []
      const middayMode = handoverUiMode === 'midday_standard_collective'
      const bullets = Array.isArray(middayHandoverBullets) ? middayHandoverBullets.map(String) : []
      if (!checklistType || (normalizedItems.length === 0 && blockingTasks.length === 0 && !middayMode)) {
        setCheckOutErr('Ungültige Server-Antwort für die Schichtende-Checkliste.')
        return
      }
      const ct = checklistType === 'closing' ? 'closing' : 'handover'
      setCheckOutEntry(json.data.timeEntry)
      setCheckoutBlockingTasks(blockingTasks)
      setCheckoutHandoverUiMode(middayMode ? 'midday_standard_collective' : undefined)
      setCheckoutMiddayBullets(middayMode ? bullets : [])
      setCheckoutCatalog({
        checklistType: ct,
        items: normalizedItems,
        wizardGroups: parseShiftCloseWizardGroups(wizardGroups),
      })
      setModal(null)
    } catch (e) {
      setCheckOutErr(e instanceof Error ? e.message : 'Netzwerkfehler')
    } finally {
      setCheckoutStartBusy(false)
    }
  }

  const renderCheckInApiConfirm = () => {
    if (!checkInApiConfirm) return null
    const p = checkInApiConfirm
    const emp = employees.find((e) => e.id === p.employeeId)
    const name = emp?.displayName ?? 'Mitarbeiter'
    const planned = p.plannedStart ? `${p.plannedStart} Uhr` : '—'
    const actual = p.actualStart ? `${p.actualStart} Uhr` : '—'
    const diffLineEarlyLate =
      p.reason === 'early' || p.reason === 'late'
        ? p.displayText ??
          (typeof p.deviationMinutes === 'number'
            ? formatCheckInDeviationFallback(p.reason, p.deviationMinutes)
            : '—')
        : null
    let title = 'Schicht starten'
    let body = p.message
    let confirmLabel = 'Schicht trotzdem beginnen'
    if (p.reason === 'early') {
      title = 'Du beginnst deine Schicht früher als geplant.'
      body = `Geplant: ${planned}\nAktuell: ${actual}\nDifferenz: ${diffLineEarlyLate ?? '—'}`
    } else if (p.reason === 'late') {
      title = 'Du beginnst deine Schicht später als geplant.'
      body = `Geplant: ${planned}\nAktuell: ${actual}\nDifferenz: ${diffLineEarlyLate ?? '—'}`
    } else if (p.reason === 'shift_ended') {
      title = 'Schicht bereits beendet'
      const span =
        p.plannedStart && p.plannedEnd ? `Geplant: ${p.plannedStart}–${p.plannedEnd} Uhr\n` : ''
      body = `${span}${p.displayText ?? p.message}\nAktuell: ${actual}`
      confirmLabel = 'Schicht trotzdem beginnen'
    } else if (p.reason === 'no_planned_shift') {
      title = 'Keine Schicht geplant'
      body = 'Für dich ist aktuell keine Schicht geplant.'
    }
    return (
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border border-amber-400/35 bg-[var(--bg-card)] p-5 shadow-xl">
          <TerminalResultMessage variant="warning" title={title} message={`${name}\n\n${body}`}>
            <Button
              variant="primary"
              type="button"
              disabled={checkInSubmitting}
              onClick={() => void finalizeCheckInByEmployee(p.employeeId, true, p.shiftId)}
            >
              {checkInSubmitting ? 'Schicht wird gestartet…' : confirmLabel}
            </Button>
            <Button variant="ghost" type="button" disabled={checkInSubmitting} onClick={() => setCheckInApiConfirm(null)}>
              Abbrechen
            </Button>
          </TerminalResultMessage>
        </div>
      </div>
    )
  }

  const finalizeCheckoutSuccess = (p: { employeeId: string; startAt: string; displayName: string }) => {
    const end = new Date().toISOString()
    const mins = calculateWorkedMinutes(p.startAt, end, new Date())
    const name = employees.find((e) => e.id === p.employeeId)?.displayName ?? p.displayName ?? ''
    const endLabel = new Date(end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    setCheckOutEntry(null)
    setCheckoutCatalog(null)
    setCheckoutBlockingTasks([])
    setCheckoutHandoverUiMode(undefined)
    setCheckoutMiddayBullets([])
    setCheckoutEndConfirm(null)
    setTerminalBakingNotice(null)
    setTerminalBakingOpen(false)
    setOutSuccess({ name, end: endLabel, dur: formatWorkedDuration(mins) })
    log({
      cardNumber: String(employees.find((e) => e.id === p.employeeId)?.cashRegisterCardNumber ?? '').trim(),
      employeeId: p.employeeId,
      actionType: 'check_out',
      result: 'success',
      message: 'Schicht beendet',
    })
  }

  const submitCheckoutWithForce = async () => {
    if (!checkoutEndConfirm) return
    try {
      await completeShiftWithChecklist(
        checkoutEndConfirm.timeEntryId,
        checkoutEndConfirm.checklist,
        undefined,
        true,
        {
          taskCloseDeclarations: checkoutEndConfirm.taskCloseDeclarations,
          taskCloseAccuracyConfirmed: checkoutEndConfirm.taskCloseAccuracyConfirmed,
        },
      )
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ausstempeln fehlgeschlagen')
      return
    }
    finalizeCheckoutSuccess({
      employeeId: checkoutEndConfirm.employeeId,
      startAt: checkoutEndConfirm.startAt,
      displayName: checkoutEndConfirm.displayName,
    })
  }

  return (
    <div
      className={`flex min-h-dvh flex-col items-center px-4 pt-8 sm:pt-12 ${tabletToken ? 'pb-24' : 'pb-12'}`}
    >
      <TabletPwaUpdateControls enabled={Boolean(tabletToken)} />

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
                setCheckInApiConfirm(null)
                setCheckOutErr(null)
                setInSuccess(null)
                setPendingShiftWarnings(null)
                setCheckInSubmitError(null)
                setCheckInSubmitting(false)
                setModal('check-in')
              }}
              onCheckOut={() => {
                setCheckInApiConfirm(null)
                setCheckOutErr(null)
                setPendingShiftWarnings(null)
                setModal('check-out')
              }}
            />
          </div>

          <RunningStaffPanel rows={runningPresence} />

          {terminalBakingNotice &&
          runningPresence.some((r) => r.id === terminalBakingNotice.timeEntryId) &&
          !terminalBakingOpen ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="text-sm font-medium text-cyan-200 underline decoration-cyan-400/50 hover:text-cyan-100"
                onClick={() => setTerminalBakingOpen(true)}
              >
                Backwaren-Hinweis erneut anzeigen
              </button>
            </div>
          ) : null}

          <div className="mt-10 w-full max-w-3xl space-y-4">
            {inSuccess ? (
              <TerminalResultMessage
                variant="success"
                title={`Hallo, ${inSuccess.name}`}
                message={`Deine Schicht wurde um ${inSuccess.time} Uhr gestartet.`}
              >
                <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto text-left text-sm text-[var(--text-muted)]">
                  <p className="font-medium text-emerald-100">Aufgaben für heute</p>
                  {(() => {
                    const bundle = tasksByEmployee[inSuccess.employeeId] ?? { tasks: [], taskLogs: [] }
                    return bundle.tasks.length === 0 ? (
                    <p>
                      Aktuell keine zusätzlichen Aufgaben. Normale Schichtaufgaben und Abschlusscheck bleiben bestehen.
                    </p>
                  ) : (
                    <ul className="list-inside list-disc space-y-1">
                      {bundle.tasks.slice(0, 12).map((t) => (
                        <li key={t.id}>{t.title}</li>
                      ))}
                    </ul>
                  )
                  })()}
                </div>
                <Button variant="ghost" type="button" onClick={() => setInSuccess(null)}>
                  Schließen
                </Button>
              </TerminalResultMessage>
            ) : null}
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
        <div className="mx-auto mt-8 w-full max-w-6xl px-3 pb-8">
          <h2 className="text-center text-xl font-semibold text-[var(--text-main)] sm:text-2xl">Aufgaben</h2>
          <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
            Pro eingestempeltem Mitarbeiter nur die zugehörigen Aufgaben (Schichtabschluss separat beim Ausstempeln).
          </p>

          {sortedPresenceForTasks.length === 0 ? (
            <p className="mt-10 text-center text-lg text-[var(--text-muted)]">Aktuell ist kein Mitarbeiter eingestempelt.</p>
          ) : (
            <div
              className={`task-presence-grid mt-8 grid w-full gap-4 ${
                sortedPresenceForTasks.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
              }`}
            >
              {sortedPresenceForTasks.map((row) => {
                const bundle = tasksByEmployee[row.employeeId] ?? { tasks: [], taskLogs: [] }
                const emp = employees.find((e) => e.id === row.employeeId)
                const displayName = emp?.displayName ?? row.displayName
                const roleLabel = (emp?.role ?? emp?.employmentRole)?.trim() || null
                const since = formatSinceClockDe(row.startAt)
                const todayYmd = toISODateLocal(new Date())
                let openCt = 0
                let doneCt = 0
                for (const t of bundle.tasks) {
                  const st = getTaskStatusForDate(t, bundle.taskLogs, todayYmd)
                  const isDone = st === 'erledigt' || st === 'kontrolliert'
                  if (isDone) doneCt += 1
                  else openCt += 1
                }
                return (
                  <section
                    key={`${row.employeeId}-${row.id}`}
                    className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-cyan-500/25 bg-black/35 p-4 shadow-[0_0_24px_rgba(34,211,238,0.08)] sm:p-5"
                  >
                    <header className="border-b border-white/10 pb-3">
                      <h3 className="text-lg font-semibold leading-snug text-cyan-50 sm:text-xl">
                        Aufgaben für {displayName} heute
                      </h3>
                      {since ? (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">Eingestempelt seit {since} Uhr</p>
                      ) : null}
                      {roleLabel ? <p className="mt-1 text-sm text-[var(--text-faint)]">{roleLabel}</p> : null}
                      <p className="mt-2 text-sm text-[var(--text-muted)]">
                        Offen: {openCt} · Erledigt: {doneCt}
                      </p>
                    </header>

                    {bundle.tasks.length === 0 ? (
                      <div className="mt-4 text-center text-[var(--text-muted)]">
                        <p>Aktuell keine zusätzlichen Aufgaben.</p>
                        <p className="mt-2 text-sm text-[var(--text-faint)]">
                          Normale Schichtaufgaben und Abschlusscheck bleiben bestehen.
                        </p>
                      </div>
                    ) : (
                      <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
                        {bundle.tasks.map((t) => {
                          const st = getTaskStatusForDate(t, bundle.taskLogs, todayYmd)
                          const done = st === 'erledigt' || st === 'kontrolliert'
                          const timing = taskDisplayTimingLine(t)
                          return (
                            <li
                              key={t.id}
                              className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
                            >
                              <div className="min-w-0">
                                <p className="text-lg font-semibold text-[var(--text-main)]">{t.title}</p>
                                <p className="mt-1 text-sm text-[var(--text-muted)]">
                                  {timing ? `${timing} · ` : ''}
                                  {workAreaLabel(t.workAreaId)} · Pflicht: {t.mandatory ? 'ja' : 'nein'}
                                </p>
                                <p className="mt-1 text-sm text-[var(--text-faint)]">Status: {st ?? '—'}</p>
                              </div>
                              <Button
                                type="button"
                                variant="primary"
                                className="mt-3 shrink-0 sm:mt-0"
                                disabled={done}
                                onClick={() =>
                                  setTaskConfirm({
                                    task: t,
                                    comment: '',
                                    employeeId: row.employeeId,
                                    displayName,
                                  })
                                }
                              >
                                Erledigt markieren
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'fuel' ? <TabletFuelPricesTab fetchFuelPrices={fetchFuelPrices} /> : null}

      {tab === 'radio' && showRadioTab ? <TabletRadioTab /> : null}

      {showRadioTab ? <TabletRadioMiniPlayer /> : null}

      {taskConfirm ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/35 bg-[var(--bg-card)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Aufgabe erledigt?</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Bestätigst du, dass du diese Aufgabe erledigt hast?</p>
            <p className="mt-3 text-sm font-medium text-cyan-100">{taskConfirm.task.title}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Für: {taskConfirm.displayName}</p>
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
                    const { employeeId, displayName } = taskConfirm
                    if (!employeeId.trim()) {
                      window.alert('Bitte zuerst einstempeln.')
                      return
                    }
                    try {
                      await completeTask(taskConfirm.task.id, {
                        date: toISODateLocal(new Date()),
                        employeeId,
                        displayName,
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

      <BakingNoticeModal
        open={terminalBakingOpen && Boolean(terminalBakingNotice)}
        payload={terminalBakingNotice}
        submitting={terminalBakingBusy}
        onDismiss={() => setTerminalBakingOpen(false)}
        onConfirm={async (remark) => {
          if (!terminalBakingNotice) return
          const sid = stationId ?? DEFAULT_TABLET_STATION_ID
          const body: Record<string, unknown> = {
            timeEntryId: terminalBakingNotice.timeEntryId,
            routineType: terminalBakingNotice.routineType,
            routineId: terminalBakingNotice.routineId,
            title: terminalBakingNotice.title,
            items: terminalBakingNotice.items,
            itemSnapshots: terminalBakingNotice.itemSnapshots,
            ...(remark ? { remark } : {}),
          }
          if (tabletToken?.trim()) body.tabletToken = tabletToken.trim()
          else body.stationId = sid
          setTerminalBakingBusy(true)
          try {
            const res = await fetch(`${API_BASE}/terminal/baking-notice`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            const json = (await res.json()) as { ok?: boolean; data?: { saved?: boolean }; error?: string }
            if (json.ok === true && json.data && json.data.saved === true) {
              setTerminalBakingOpen(false)
            } else {
              window.alert(String(json.error ?? 'Speichern fehlgeschlagen.'))
            }
          } catch {
            window.alert('Netzwerkfehler.')
          } finally {
            setTerminalBakingBusy(false)
          }
        }}
      />

      {renderCheckInApiConfirm()}

      {checkoutEndConfirm ? (
        <div className="fixed inset-0 z-[136] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-amber-400/35 bg-[var(--bg-card)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Schichtende außerhalb der Toleranz</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{checkoutEndConfirm.message}</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[var(--text-main)]">
              <p>
                <span className="text-[var(--text-faint)]">Geplant (Ende):</span> {checkoutEndConfirm.plannedEnd} Uhr
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Aktuell:</span> {checkoutEndConfirm.actualEnd} Uhr
              </p>
              <p>
                <span className="text-[var(--text-faint)]">Differenz:</span>{' '}
                {checkoutEndConfirm.deviationMinutes} Minuten{' '}
                {checkoutEndConfirm.endDeviationReason === 'late_end'
                  ? 'später'
                  : checkoutEndConfirm.endDeviationReason === 'early_end'
                    ? 'früher'
                    : ''}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setCheckoutEndConfirm(null)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" className="flex-1" onClick={() => void submitCheckoutWithForce()}>
                Schicht trotzdem beenden
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

      <TerminalEmployeePickModal
        open={modal !== null}
        mode={modal === 'check-out' ? 'check-out' : 'check-in'}
        employees={employees}
        runningPresence={runningPresence}
        shifts={shifts}
        checkInSuggestions={checkInSuggestionsPayload?.suggestions ?? []}
        checkInAllEmployees={checkInSuggestionsPayload?.allEmployees}
        checkInSuggestionsLoading={checkInSugLoading}
        checkInSuggestionsError={checkInSugErr}
        checkInSubmitting={modal === 'check-in' ? checkInSubmitting : false}
        checkInSubmitError={modal === 'check-in' ? checkInSubmitError : null}
        onClearCheckInSubmitError={() => setCheckInSubmitError(null)}
        checkoutBusy={modal === 'check-out' ? checkoutStartBusy : false}
        checkoutError={modal === 'check-out' ? checkOutErr : null}
        onClose={closeModal}
        onConfirmCheckIn={(employeeId, sid) => void finalizeCheckInByEmployee(employeeId, false, sid)}
        onPickCheckOut={(row) => void startCheckoutChecklistForEmployee(row.employeeId)}
      />

      {checkOutEntry && checkoutCatalog ? (
        <ShiftCloseChecklistModal
          open
          layout="tablet"
          employeeName={employees.find((e) => e.id === checkOutEntry.employeeId)?.displayName ?? 'Mitarbeiter'}
          timeEntryId={checkOutEntry.id}
          employeeId={checkOutEntry.employeeId}
          checklistType={checkoutCatalog.checklistType}
          catalogItems={checkoutCatalog.items}
          wizardGroups={checkoutCatalog.wizardGroups}
          blockingTasks={checkoutBlockingTasks.length > 0 ? checkoutBlockingTasks : undefined}
          submitButtonLabel="Schicht endgültig beenden"
          onClose={() => {
            setCheckOutEntry(null)
            setCheckoutCatalog(null)
            setCheckoutBlockingTasks([])
            setCheckoutHandoverUiMode(undefined)
            setCheckoutMiddayBullets([])
          }}
          handoverUiMode={checkoutHandoverUiMode}
          middayHandoverBullets={checkoutMiddayBullets.length > 0 ? checkoutMiddayBullets : undefined}
          onComplete={async (payload) => {
            const { checklist, taskCloseDeclarations, taskCloseAccuracyConfirmed } = payload
            const entry = checkOutEntry
            const displayName = employees.find((e) => e.id === entry.employeeId)?.displayName ?? 'Mitarbeiter'
            try {
              await completeShiftWithChecklist(entry.id, checklist, undefined, false, {
                taskCloseDeclarations,
                taskCloseAccuracyConfirmed,
              })
            } catch (err) {
              const e = err as Error & { code?: string; detail?: Record<string, unknown> }
              if (e.code === 'checkout_requires_confirmation' && e.detail) {
                const d = e.detail
                setCheckoutEndConfirm({
                  timeEntryId: entry.id,
                  employeeId: entry.employeeId,
                  displayName,
                  startAt: entry.startAt,
                  checklist,
                  taskCloseDeclarations,
                  taskCloseAccuracyConfirmed,
                  plannedEnd: String(d.plannedEnd ?? ''),
                  actualEnd: String(d.actualEnd ?? ''),
                  deviationMinutes: Number(d.deviationMinutes ?? 0),
                  endDeviationReason: typeof d.reason === 'string' ? d.reason : undefined,
                  message: String(d.message ?? ''),
                })
                const clientNowIso = new Date().toISOString()
                if (import.meta.env.DEV) {
                  console.info('[tablet checkout end confirm]', {
                    employeeName: displayName,
                    timeEntryClockInAt: entry.startAt,
                    plannedEndHm: d.plannedEnd,
                    actualEndHmFromServer: d.actualEnd,
                    deviationMinutes: d.deviationMinutes,
                    reason: d.reason,
                    clientNowIso,
                    clientNowHmBerlin: new Intl.DateTimeFormat('de-DE', {
                      timeZone: 'Europe/Berlin',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    }).format(new Date()),
                    stationTimezone: 'Europe/Berlin',
                  })
                }
                return
              }
              window.alert(err instanceof Error ? err.message : 'Ausstempeln fehlgeschlagen')
              return
            }
            finalizeCheckoutSuccess({
              employeeId: entry.employeeId,
              startAt: entry.startAt,
              displayName,
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
