import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ControlResult, Task, TaskLog } from '../types/task'
import {
  cloneSeedTaskLogs,
  cloneSeedTasks,
  createTaskId,
  createTaskLogId,
} from '../data/mockTasks'

const CURRENT_USER = 'Mathias Raselowski'

type TasksContextValue = {
  tasks: Task[]
  logs: TaskLog[]
  addTask: (t: Task) => void
  updateTask: (t: Task) => void
  removeTask: (id: string) => void
  setTaskActive: (id: string, active: boolean) => void
  confirmTask: (taskId: string, date: string, comment?: string) => void
  controlTask: (taskId: string, date: string, result: ControlResult, comment?: string) => void
  logsForTask: (taskId: string) => TaskLog[]
}

const TasksContext = createContext<TasksContextValue | null>(null)

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => cloneSeedTasks())
  const [logs, setLogs] = useState<TaskLog[]>(() => cloneSeedTaskLogs())

  const addTask = useCallback((t: Task) => {
    const id = t.id?.trim() ? t.id : createTaskId()
    const now = new Date().toISOString()
    setTasks((prev) => [...prev, { ...t, id, createdAt: t.createdAt || now, updatedAt: now }])
  }, [])

  const updateTask = useCallback((t: Task) => {
    const now = new Date().toISOString()
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...t, updatedAt: now } : x)))
  }, [])

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((x) => x.id !== id))
    setLogs((prev) => prev.filter((l) => l.taskId !== id))
  }, [])

  const setTaskActive = useCallback((id: string, active: boolean) => {
    const now = new Date().toISOString()
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, active, updatedAt: now } : x)))
  }, [])

  const confirmTask = useCallback((taskId: string, date: string, comment?: string) => {
    const now = new Date().toISOString()
    setLogs((prev) => {
      const idx = prev.findIndex((l) => l.taskId === taskId && l.date === date)
      const next: TaskLog = {
        id: idx >= 0 ? prev[idx]!.id : createTaskLogId(),
        taskId,
        date,
        status: 'erledigt',
        confirmedAt: now,
        confirmedBy: CURRENT_USER,
        comment: comment?.trim() || prev[idx]?.comment,
      }
      if (idx >= 0) {
        return prev.map((l, i) => (i === idx ? { ...prev[idx]!, ...next } : l))
      }
      return [...prev, next]
    })
  }, [])

  const controlTask = useCallback(
    (taskId: string, date: string, result: ControlResult, comment?: string) => {
      const now = new Date().toISOString()
      setLogs((prev) => {
        const idx = prev.findIndex((l) => l.taskId === taskId && l.date === date)
        const base: TaskLog =
          idx >= 0
            ? prev[idx]!
            : {
                id: createTaskLogId(),
                taskId,
                date,
                status: 'offen',
              }
        const status = result === 'ok' ? 'kontrolliert' : 'mangel'
        const merged: TaskLog = {
          ...base,
          status,
          controlledAt: now,
          controlledBy: CURRENT_USER,
          controlResult: result,
          comment: comment?.trim() || base.comment,
        }
        if (idx >= 0) return prev.map((l, i) => (i === idx ? merged : l))
        return [...prev, merged]
      })
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
