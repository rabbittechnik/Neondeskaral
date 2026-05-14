import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TaskLogsHistoryTable } from '../../components/tasks/TaskLogsHistoryTable'
import { useStation } from '../../context/station-context'
import { useAuth } from '../../context/auth-context'
import { apiGet } from '../../services/api'
import type { Employee } from '../../types/employee'
import type { Task, TaskLog, TaskStatus } from '../../types/task'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const STATUS_OPTIONS: Array<{ value: '' | TaskStatus; label: string }> = [
  { value: '', label: 'Alle Status' },
  { value: 'offen', label: 'Offen' },
  { value: 'erledigt', label: 'Erledigt' },
  { value: 'überfällig', label: 'Überfällig' },
  { value: 'mangel', label: 'Mangel / nicht erledigt' },
  { value: 'in_kontrolle', label: 'In Kontrolle' },
  { value: 'kontrolliert', label: 'Kontrolliert' },
]

export function TaskReportsPage() {
  const { stationId, hasPermission } = useStation()
  const { user } = useAuth()
  const canView = Boolean(user?.globalAdmin || hasPermission('tasks.view'))

  const today = useMemo(() => new Date(), [])
  const [from, setFrom] = useState(() => isoDate(addDays(today, -30)))
  const [to, setTo] = useState(() => isoDate(today))
  const [employeeId, setEmployeeId] = useState<string>('')
  const [status, setStatus] = useState<'' | TaskStatus>('')
  const [mandatoryOnly, setMandatoryOnly] = useState(false)
  const [shiftCloseOnly, setShiftCloseOnly] = useState(false)
  const [taskKind, setTaskKind] = useState<string>('')

  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setErr(null)
    const [tRes, lRes, eRes] = await Promise.all([
      apiGet<Task[]>('/tasks', { stationId }),
      apiGet<TaskLog[]>('/task-logs', { stationId, from, to }),
      apiGet<Employee[]>('/employees', { stationId }),
    ])
    if (!tRes.ok) setErr(tRes.error)
    else setTasks(Array.isArray(tRes.data) ? tRes.data : [])
    if (!lRes.ok) setErr(lRes.error)
    else setLogs(Array.isArray(lRes.data) ? lRes.data : [])
    if (!eRes.ok) setEmployees([])
    else setEmployees(Array.isArray(eRes.data) ? eRes.data : [])
    setLoading(false)
  }, [stationId, canView, from, to])

  useEffect(() => {
    void load()
  }, [load])

  const taskById = useMemo(() => {
    const m = new Map<string, Task>()
    for (const t of tasks) m.set(t.id, t)
    return m
  }, [tasks])

  const taskKinds = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) {
      const k = (t as { taskKind?: string }).taskKind
      if (k) s.add(k)
    }
    return [...s].sort()
  }, [tasks])

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const task = taskById.get(l.taskId)
      if (!task) return true
      if (mandatoryOnly && !task.mandatory) return false
      if (shiftCloseOnly && !task.requiredForShiftClose) return false
      if (taskKind && (task as { taskKind?: string }).taskKind !== taskKind) return false
      if (employeeId) {
        const matchEmp = l.employeeId === employeeId
        const matchAssign = task.assignedEmployeeId === employeeId
        if (!matchEmp && !matchAssign) return false
      }
      if (status && l.status !== status) return false
      return true
    })
  }, [logs, taskById, mandatoryOnly, shiftCloseOnly, taskKind, employeeId, status])

  const summary = useMemo(() => {
    const todayStr = isoDate(new Date())
    let open = 0
    let done = 0
    let notDone = 0
    let withComment = 0
    let overdue = 0
    for (const l of filteredLogs) {
      if (l.status === 'erledigt' || l.status === 'kontrolliert') done++
      else if (l.status === 'offen' || l.status === 'in_kontrolle') {
        open++
        if (l.date < todayStr) overdue++
      }
      if (l.status === 'mangel') notDone++
      if (l.comment?.trim()) withComment++
    }
    return { open, done, notDone, withComment, overdue, total: filteredLogs.length }
  }, [filteredLogs])

  const exportCsv = () => {
    const headers = ['Datum', 'Aufgabe', 'Status', 'MitarbeiterId', 'Kommentar', 'NichtErledigtGrund']
    const lines = filteredLogs.map((l) => {
      const title = taskById.get(l.taskId)?.title ?? l.taskId
      const emp = l.employeeId ?? l.confirmedBy ?? ''
      const cells = [l.date, title, l.status, emp, l.comment ?? '', l.notDoneReason ?? '']
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')
    })
    const blob = new Blob([[headers.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aufgaben-auswertung-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!canView) {
    return <div className="p-6 text-sm text-[var(--text-muted)]">Keine Berechtigung für Aufgaben-Auswertungen.</div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 pb-16">
      <PageHeader title="Auswertung Aufgaben" description="Schicht- und Tablet-Aufgaben nach Zeitraum und Filtern" />

      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}

      <Card padding="md" className="border-[var(--border-subtle)] space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-[var(--text-muted)]">
            Von
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[var(--text-main)]"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            Bis
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[var(--text-main)]"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            Mitarbeiter
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[var(--text-main)]"
            >
              <option value="">Alle</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as '' | TaskStatus)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[var(--text-main)]"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[var(--text-muted)]">
            <input type="checkbox" checked={mandatoryOnly} onChange={(e) => setMandatoryOnly(e.target.checked)} className="rounded border-white/20" />
            Nur Pflichtaufgaben
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[var(--text-muted)]">
            <input type="checkbox" checked={shiftCloseOnly} onChange={(e) => setShiftCloseOnly(e.target.checked)} className="rounded border-white/20" />
            Nur Schichtabschluss
          </label>
          {taskKinds.length > 0 ? (
            <label className="inline-flex items-center gap-2 text-[var(--text-muted)]">
              Art
              <select
                value={taskKind}
                onChange={(e) => setTaskKind(e.target.value)}
                className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[var(--text-main)]"
              >
                <option value="">Alle</option>
                {taskKinds.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
            Aktualisieren
          </Button>
          <Button type="button" variant="outline" disabled={!filteredLogs.length} onClick={exportCsv}>
            CSV exportieren
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Einträge (gefiltert)', value: summary.total },
          { label: 'Offen', value: summary.open },
          { label: 'Überfällig (Datum)', value: summary.overdue },
          { label: 'Erledigt / kontrolliert', value: summary.done },
          { label: 'Mangel / nicht erledigt', value: summary.notDone },
          { label: 'Mit Kommentar', value: summary.withComment },
        ].map((k) => (
          <Card key={k.label} padding="md" className="border-[var(--border-subtle)]">
            <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{k.value}</p>
          </Card>
        ))}
      </div>

      <TaskLogsHistoryTable logs={filteredLogs} tasks={tasks} employees={employees} />
    </div>
  )
}
