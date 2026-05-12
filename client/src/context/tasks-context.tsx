import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ControlResult, Task, TaskLog } from '../types/task'
import { createTaskId } from '../data/mockTasks'
import { apiGet, apiSend } from '../services/api'
import { useStation } from './station-context'

const CURRENT_USER = 'Mathias Raselowski'

type TasksContextValue = {
  tasks: Task[]
  logs: TaskLog[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  addTask: (t: Task) => Promise<void>
  updateTask: (t: Task) => Promise<void>
  removeTask: (id: string) => Promise<void>
  setTaskActive: (id: string, active: boolean) => Promise<void>
  confirmTask: (taskId: string, date: string, comment?: string) => Promise<void>
  controlTask: (taskId: string, date: string, result: ControlResult, comment?: string) => Promise<void>
  logsForTask: (taskId: string) => TaskLog[]
}

const TasksContext = createContext<TasksContextValue | null>(null)

function mergeLogs(prev: TaskLog[], incoming: TaskLog[]): TaskLog[] {
  const map = new Map(prev.map((l) => [`${l.taskId}|${l.date}`, l]))
  for (const l of incoming) {
    map.set(`${l.taskId}|${l.date}`, l)
  }
  return [...map.values()]
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { stationId } = useStation()
  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
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
    void refetch()
  }, [refetch])

  const addTask = useCallback(
    async (t: Task) => {
      if (!stationId) throw new Error('Keine Station gewählt')
      const id = t.id?.trim() ? t.id : createTaskId()
      const now = new Date().toISOString()
      const res = await apiSend<Task>(
        'POST',
        '/tasks',
        { ...t, id, createdAt: t.createdAt || now, updatedAt: now },
        { stationId },
      )
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch, stationId],
  )

  const updateTask = useCallback(
    async (t: Task) => {
      const res = await apiSend<Task>('PUT', `/tasks/${encodeURIComponent(t.id)}`, t)
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const removeTask = useCallback(
    async (id: string) => {
      const res = await apiSend('DELETE', `/tasks/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const setTaskActive = useCallback(
    async (id: string, active: boolean) => {
      const cur = tasks.find((x) => x.id === id)
      if (!cur) return
      const res = await apiSend<Task>('PUT', `/tasks/${encodeURIComponent(id)}`, { ...cur, active })
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [tasks, refetch],
  )

  const confirmTask = useCallback(
    async (taskId: string, date: string, comment?: string) => {
      const res = await apiSend<TaskLog[]>('POST', `/tasks/${encodeURIComponent(taskId)}/confirm`, {
        date,
        comment,
        by: CURRENT_USER,
      })
      if (!res.ok || !Array.isArray(res.data)) throw new Error(res.ok === false ? res.error : 'Fehler')
      setLogs((prev) => mergeLogs(prev, res.data as TaskLog[]))
    },
    [],
  )

  const controlTask = useCallback(
    async (taskId: string, date: string, result: ControlResult, comment?: string) => {
      const res = await apiSend<TaskLog[]>('POST', `/tasks/${encodeURIComponent(taskId)}/control`, {
        date,
        result,
        comment,
        by: CURRENT_USER,
      })
      if (!res.ok || !Array.isArray(res.data)) throw new Error(res.ok === false ? res.error : 'Fehler')
      setLogs((prev) => mergeLogs(prev, res.data as TaskLog[]))
    },
    [],
  )

  const logsForTask = useCallback(
    (taskId: string) =>
      logs
        .filter((l) => l.taskId === taskId)
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [logs],
  )

  const value = useMemo(
    () => ({
      tasks,
      logs,
      loading,
      error,
      refetch,
      addTask,
      updateTask,
      removeTask,
      setTaskActive,
      confirmTask,
      controlTask,
      logsForTask,
    }),
    [
      tasks,
      logs,
      loading,
      error,
      refetch,
      addTask,
      updateTask,
      removeTask,
      setTaskActive,
      confirmTask,
      controlTask,
      logsForTask,
    ],
  )

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext)
  if (!ctx) throw new Error('useTasks must be used within TasksProvider')
  return ctx
}
