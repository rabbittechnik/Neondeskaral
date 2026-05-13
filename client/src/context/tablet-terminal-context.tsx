import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ScheduleShift } from '../data/mockSchedule'
import type { TimeEntry } from '../types/timeTracking'
import type { Task, TaskLog } from '../types/task'
import type { WorkAreaDefinition } from '../types/employee'
import { API_BASE } from '../services/api'
import { useStation } from './station-context'
import type { ClockCardEmployee } from '../utils/timeTrackingUtils'

function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) return ''
  const e = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') e.set(k, v)
  }
  const s = e.toString()
  return s ? `?${s}` : ''
}

async function tabletGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${buildQuery(params)}`
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return { ok: false, error: 'Server nicht erreichbar. Bitte Verbindung prüfen.' }
  }
  let json: { ok?: boolean; data?: T; error?: string } = {}
  try {
    json = (await res.json()) as { ok?: boolean; data?: T; error?: string }
  } catch {
    return { ok: false, error: 'Server nicht erreichbar. Bitte Verbindung prüfen.' }
  }
  if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` }
  if (json && typeof json === 'object' && json.ok === false) {
    return { ok: false, error: String(json.error ?? 'Fehler') }
  }
  if (json && typeof json === 'object' && json.ok === true && 'data' in json) {
    return { ok: true, data: json.data as T }
  }
  return { ok: false, error: 'Ungültige Server-Antwort' }
}

export type TabletRunningRow = {
  id: string
  employeeId: string
  displayName: string
  startAt: string
  source: string
}

export type FuelPricesPayload =
  | {
      ok: true
      configured: true
      provider: string
      stationId: string
      providerStationId: string
      station: {
        name: string
        brand: string
        street: string
        houseNumber: string
        postCode: string
        place: string
      }
      prices: { diesel: number; e5: number; e10: number }
      isOpen: boolean
      currency: string
      source: string
      fetchedAt: string
      cacheWarning?: string
    }
  | { ok: false; configured: boolean; message: string; cacheWarning?: string }

type TabletTerminalContextValue = {
  employees: ClockCardEmployee[]
  timeEntries: TimeEntry[]
  shifts: ScheduleShift[]
  workAreas: WorkAreaDefinition[]
  runningPresence: TabletRunningRow[]
  tasks: Task[]
  taskLogs: TaskLog[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  refetchRunning: () => Promise<void>
  refetchTasks: (employeeId?: string | null) => Promise<void>
  completeShiftWithChecklist: (timeEntryId: string, checklist: Record<string, unknown>) => Promise<void>
  completeTask: (taskId: string, body: { date: string; employeeId: string; displayName: string; comment?: string }) => Promise<void>
  fetchFuelPrices: (opts?: { forceRefresh?: boolean }) => Promise<FuelPricesPayload>
}

const TabletTerminalContext = createContext<TabletTerminalContextValue | null>(null)

export function TabletTerminalProvider({ children }: { children: ReactNode }) {
  const { stationId } = useStation()
  const [employees, setEmployees] = useState<ClockCardEmployee[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [shifts, setShifts] = useState<ScheduleShift[]>([])
  const [workAreas, setWorkAreas] = useState<WorkAreaDefinition[]>([])
  const [runningPresence, setRunningPresence] = useState<TabletRunningRow[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetchRunning = useCallback(async () => {
    if (!stationId) {
      setRunningPresence([])
      return
    }
    const res = await tabletGet<TabletRunningRow[]>('/tablet/running-presence', { stationId })
    if (res.ok) setRunningPresence(res.data)
  }, [stationId])

  const refetch = useCallback(async () => {
    if (!stationId) {
      setEmployees([])
      setTimeEntries([])
      setShifts([])
      setWorkAreas([])
      setRunningPresence([])
      setTasks([])
      setTaskLogs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const from = new Date()
    from.setDate(from.getDate() - 14)
    const to = new Date()
    to.setDate(to.getDate() + 56)
    const fromY = from.toISOString().slice(0, 10)
    const toY = to.toISOString().slice(0, 10)

    const [eRes, tRes, sRes, wRes, rRes] = await Promise.all([
      tabletGet<ClockCardEmployee[]>('/tablet/employees', { stationId }),
      tabletGet<TimeEntry[]>('/tablet/time-entries', { stationId }),
      tabletGet<ScheduleShift[]>('/tablet/shifts-range', { stationId, from: fromY, to: toY }),
      tabletGet<WorkAreaDefinition[]>('/tablet/work-areas', { stationId }),
      tabletGet<TabletRunningRow[]>('/tablet/running-presence', { stationId }),
    ])
    if (!eRes.ok) setError(eRes.error)
    else setEmployees(eRes.data)
    if (!tRes.ok) setError((p) => (p ? `${p}; ${tRes.error}` : tRes.error))
    else setTimeEntries(tRes.data)
    if (!sRes.ok) setError((p) => (p ? `${p}; ${sRes.error}` : sRes.error))
    else setShifts(sRes.data)
    if (!wRes.ok) setError((p) => (p ? `${p}; ${wRes.error}` : wRes.error))
    else setWorkAreas(wRes.data)
    if (!rRes.ok) setError((p) => (p ? `${p}; ${rRes.error}` : rRes.error))
    else setRunningPresence(rRes.data)

    const taskRes = await tabletGet<{ tasks: Task[]; taskLogs: TaskLog[] }>('/tablet/tasks-today', {
      stationId,
    })
    if (!taskRes.ok) setError((p) => (p ? `${p}; ${taskRes.error}` : taskRes.error))
    else {
      setTasks(taskRes.data.tasks)
      setTaskLogs(taskRes.data.taskLogs)
    }
    setLoading(false)
  }, [stationId])

  const refetchTasks = useCallback(
    async (employeeId?: string | null) => {
      if (!stationId) return
      const taskRes = await tabletGet<{ tasks: Task[]; taskLogs: TaskLog[] }>('/tablet/tasks-today', {
        stationId,
        employeeId: employeeId ?? undefined,
      })
      if (taskRes.ok) {
        setTasks(taskRes.data.tasks)
        setTaskLogs(taskRes.data.taskLogs)
      }
    },
    [stationId],
  )

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!stationId) return
    const id = window.setInterval(() => void refetchRunning(), 30_000)
    return () => window.clearInterval(id)
  }, [stationId, refetchRunning])

  const completeShiftWithChecklist = useCallback(
    async (timeEntryId: string, checklist: Record<string, unknown>) => {
      const url = `${API_BASE}/terminal/check-out-complete`
      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeEntryId, checklist }),
        })
      } catch {
        throw new Error('Server nicht erreichbar. Bitte Verbindung prüfen.')
      }
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: unknown }
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? 'Ausstempeln fehlgeschlagen')
      }
      await refetch()
    },
    [refetch],
  )

  const completeTask = useCallback(
    async (taskId: string, body: { date: string; employeeId: string; displayName: string; comment?: string }) => {
      if (!stationId) throw new Error('Keine Station')
      const url = `${API_BASE}/tablet/tasks/${encodeURIComponent(taskId)}/complete${buildQuery({ stationId })}`
      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {
        throw new Error('Server nicht erreichbar. Bitte Verbindung prüfen.')
      }
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? 'Speichern fehlgeschlagen')
      }
      await refetch()
    },
    [stationId, refetch],
  )

  const fetchFuelPrices = useCallback(
    async (opts?: { forceRefresh?: boolean }) => {
      if (!stationId) {
        return { ok: false, configured: false, message: 'Keine Station.' } as FuelPricesPayload
      }
      const q = buildQuery({
        stationId,
        forceRefresh: opts?.forceRefresh ? 'true' : undefined,
      })
      let res: Response
      try {
        res = await fetch(`${API_BASE}/fuel-prices${q}`)
      } catch {
        return { ok: false as const, configured: true, message: 'Server nicht erreichbar. Bitte Verbindung prüfen.' }
      }
      return (await res.json()) as FuelPricesPayload
    },
    [stationId],
  )

  const value = useMemo(
    () => ({
      employees,
      timeEntries,
      shifts,
      workAreas,
      runningPresence,
      tasks,
      taskLogs,
      loading,
      error,
      refetch,
      refetchRunning,
      refetchTasks,
      completeShiftWithChecklist,
      completeTask,
      fetchFuelPrices,
    }),
    [
      employees,
      timeEntries,
      shifts,
      workAreas,
      runningPresence,
      tasks,
      taskLogs,
      loading,
      error,
      refetch,
      refetchRunning,
      refetchTasks,
      completeShiftWithChecklist,
      completeTask,
      fetchFuelPrices,
    ],
  )

  return <TabletTerminalContext.Provider value={value}>{children}</TabletTerminalContext.Provider>
}

export function useTabletTerminal(): TabletTerminalContextValue {
  const ctx = useContext(TabletTerminalContext)
  if (!ctx) throw new Error('useTabletTerminal must be used within TabletTerminalProvider')
  return ctx
}
