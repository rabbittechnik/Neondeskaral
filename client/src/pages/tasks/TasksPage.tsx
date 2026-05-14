import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileDown, LayoutGrid, Plus, Printer } from 'lucide-react'
import { useTasks } from '../../context/tasks-context'
import { useEmployees } from '../../context/employees-context'
import { useWorkAreas } from '../../context/work-areas-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { applyTaskFilters, type TaskListFilters } from '../../components/tasks/filterTasks'
import { TaskTabs } from '../../components/tasks/TaskTabs'
import { TasksToolbar } from '../../components/tasks/TasksToolbar'
import { TaskList } from '../../components/tasks/TaskList'
import { TodayTasksPanel } from '../../components/tasks/TodayTasksPanel'
import { TaskModal } from '../../components/tasks/TaskModal'
import { TaskDetailDrawer } from '../../components/tasks/TaskDetailDrawer'
import { TaskConfirmModal } from '../../components/tasks/TaskConfirmModal'
import { BackshopRoutinePanel } from './BackshopRoutinePanel'
import { TaskTemplatesPanel } from '../../components/tasks/TaskTemplatesPanel'
import { TaskLogsHistoryTable } from '../../components/tasks/TaskLogsHistoryTable'
import { TaskControlModal } from '../../components/tasks/TaskControlModal'
import type { Task } from '../../types/task'
import { toISODateLocal } from '../../utils/taskUtils'

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

type TasksArea = 'tasks' | 'templates' | 'planned' | 'history' | 'backshop'

function tasksAreaFromTab(tab: string | null): TasksArea {
  if (tab === 'backshop') return 'backshop'
  if (tab === 'templates') return 'templates'
  if (tab === 'planned') return 'planned'
  if (tab === 'history') return 'history'
  return 'tasks'
}

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const area = tasksAreaFromTab(searchParams.get('tab'))
  const { tasks, logs, addTask, updateTask, removeTask, setTaskActive, confirmTask, controlTask, loading, error } =
    useTasks()
  const { employees } = useEmployees()
  const { definitions: workAreaDefinitions } = useWorkAreas()
  const refDate = useMemo(() => toISODateLocal(new Date()), [])

  const [filters, setFilters] = useState<TaskListFilters>({
    search: '',
    workAreaId: '',
    status: 'all',
    recurrence: 'all',
    assignee: 'all',
  })
  const [layout, setLayout] = useState<'table' | 'cards'>('table')
  const [modal, setModal] = useState<{ open: boolean; mode: 'create' | 'edit'; task: Task | null }>({
    open: false,
    mode: 'create',
    task: null,
  })
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmTaskRef, setConfirmTaskRef] = useState<Task | null>(null)
  const [controlTaskRef, setControlTaskRef] = useState<Task | null>(null)

  const routineTasks = useMemo(
    () => tasks.filter((t) => String(t.taskKind ?? 'standard') !== 'weekend_generated'),
    [tasks],
  )
  const plannedWeekendTasks = useMemo(
    () => tasks.filter((t) => String(t.taskKind ?? '') === 'weekend_generated'),
    [tasks],
  )

  const filtered = useMemo(
    () => applyTaskFilters(routineTasks, logs, filters, refDate, new Date()),
    [routineTasks, logs, filters, refDate],
  )

  const filteredPlanned = useMemo(
    () => applyTaskFilters(plannedWeekendTasks, logs, filters, refDate, new Date()),
    [plannedWeekendTasks, logs, filters, refDate],
  )

  const exportCsv = () => {
    const header = ['Titel', 'Bereich', 'Intervall', 'Start', 'Ende', 'Zeit', 'Aktiv']
    const lines = [header.join(',')]
    for (const t of routineTasks) {
      lines.push(
        [t.title, t.workAreaId, t.recurrenceType, t.startDate, t.endDate ?? '', `${t.startTime}-${t.endTime}`, t.active ? 'ja' : 'nein']
          .map((c) => csvEscape(String(c)))
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aufgaben-${refDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {(
          [
            ['tasks', 'Aufgaben & Serien'],
            ['templates', 'Vorlagen / Regeln'],
            ['planned', 'Geplant (Wochenende)'],
            ['history', 'Historie'],
            ['backshop', 'Morgendliche Routine / Backshop'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              area === key ? 'bg-cyan-500/20 text-cyan-100' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            onClick={() => {
              const p = new URLSearchParams(searchParams)
              if (key === 'tasks') p.delete('tab')
              else p.set('tab', key)
              setSearchParams(p, { replace: true })
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <PageHeader
        title={
          area === 'backshop'
            ? 'Morgendliche Routine / Backshop'
            : area === 'templates'
              ? 'Aufgaben-Vorlagen'
              : area === 'planned'
                ? 'Geplante Wochenend-Aufgaben'
                : area === 'history'
                  ? 'Aufgaben-Historie'
                  : 'Aufgaben'
        }
        description={
          area === 'backshop'
            ? 'Backwaren-Vorgaben für die Frühschicht (Popup nach Einstempeln). Getrennt nach Wochentag, Wochenende und Feiertag.'
            : area === 'templates'
              ? 'Alle Regeln für Pflichten, Wochenend-Pool und Jahresaufgaben – stationsbezogen, bearbeitbar, ohne versteckte Code-Liste.'
              : area === 'planned'
                ? 'Konkrete aus Vorlagen erzeugte Aufgaben je Schicht (z. B. Wochenende).'
                : area === 'history'
                  ? 'Erledigungen und Status aus den Aufgaben-Logs deiner Station.'
                  : 'Wiederkehrende Aufgaben und Serien ohne die automatisch erzeugten Wochenend-Zuweisungen (die siehst du unter „Geplant“).'
        }
        actions={
          area === 'tasks' ? (
            <>
              <Button
                variant="primary"
                type="button"
                onClick={() => setModal({ open: true, mode: 'create', task: null })}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Aufgabe erstellen
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => window.alert('Aufgabenplan: später mit Kalenderansicht verknüpfbar.')}
                leftIcon={<LayoutGrid className="h-4 w-4" />}
              >
                Aufgabenplan
              </Button>
              <Button variant="ghost" type="button" onClick={exportCsv} leftIcon={<FileDown className="h-4 w-4" />}>
                Export
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => window.alert('Druckansicht: Strg+P oder später PDF-Export.')}
                leftIcon={<Printer className="h-4 w-4" />}
              >
                Druckansicht
              </Button>
            </>
          ) : undefined
        }
      />

      {area === 'backshop' ? (
        <BackshopRoutinePanel />
      ) : area === 'templates' ? (
        <TaskTemplatesPanel />
      ) : area === 'history' ? (
        <>
          {loading ? <p className="text-sm text-[var(--text-muted)]">Daten werden geladen…</p> : null}
          {error ? (
            <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
              {error}
            </p>
          ) : null}
          <TaskLogsHistoryTable logs={logs} tasks={tasks} employees={employees} />
        </>
      ) : (
        <>
          {loading ? <p className="text-sm text-[var(--text-muted)]">Aufgaben werden geladen…</p> : null}
          {error ? (
            <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
              {error}
            </p>
          ) : null}

          <TasksToolbar
            search={filters.search}
            onSearch={(search) => setFilters((f) => ({ ...f, search }))}
            workAreaId={filters.workAreaId}
            onWorkArea={(workAreaId) => setFilters((f) => ({ ...f, workAreaId }))}
            workAreas={workAreaDefinitions}
            status={filters.status}
            onStatus={(status) => setFilters((f) => ({ ...f, status }))}
            recurrence={filters.recurrence}
            onRecurrence={(recurrence) => setFilters((f) => ({ ...f, recurrence }))}
            assignee={filters.assignee}
            onAssignee={(assignee) => setFilters((f) => ({ ...f, assignee }))}
            employees={employees}
            onCreate={() => setModal({ open: true, mode: 'create', task: null })}
            onPlan={() => window.alert('Aufgabenplan (Demo)')}
            onExport={exportCsv}
            onPrint={() => window.alert('Druckansicht (Demo)')}
          />

          <TaskTabs
            tasks={area === 'planned' ? plannedWeekendTasks : routineTasks}
            value={filters.recurrence}
            onChange={(recurrence) => setFilters((f) => ({ ...f, recurrence }))}
          />

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="xl:col-span-3">
              <TaskList
                tasks={area === 'planned' ? filteredPlanned : filtered}
                logs={logs}
                employees={employees}
                refDate={refDate}
                layout={layout}
                onLayout={setLayout}
                onView={(t) => setDrawerTask(t)}
                onEdit={(t) => setModal({ open: true, mode: 'edit', task: t })}
                onToggleActive={(t) => {
                  if (t.active) setDeactivateId(t.id)
                  else void setTaskActive(t.id, true)
                }}
                onDelete={(t) => setDeleteId(t.id)}
                onConfirm={(t) => setConfirmTaskRef(t)}
                onControl={(t) => setControlTaskRef(t)}
              />
            </div>
            <div className="xl:col-span-1">
              <TodayTasksPanel tasks={area === 'planned' ? plannedWeekendTasks : routineTasks} logs={logs} refDate={refDate} />
            </div>
          </div>
        </>
      )}

      <TaskModal
        open={modal.open}
        mode={modal.mode}
        task={modal.task}
        onClose={() => setModal((s) => ({ ...s, open: false }))}
        onSave={(t) => {
          if (modal.mode === 'create') void addTask(t)
          else void updateTask(t)
        }}
      />

      <TaskDetailDrawer
        open={Boolean(drawerTask)}
        task={drawerTask}
        logs={logs}
        employees={employees}
        onClose={() => setDrawerTask(null)}
      />

      <TaskConfirmModal
        open={Boolean(confirmTaskRef)}
        title="Aufgabe bestätigen"
        onClose={() => setConfirmTaskRef(null)}
        onConfirm={(comment) => {
          if (confirmTaskRef) void confirmTask(confirmTaskRef.id, refDate, comment)
          setConfirmTaskRef(null)
        }}
      />

      <TaskControlModal
        open={Boolean(controlTaskRef)}
        onClose={() => setControlTaskRef(null)}
        onSubmit={(result, comment) => {
          if (controlTaskRef) void controlTask(controlTaskRef.id, refDate, result, comment)
          setControlTaskRef(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivateId)}
        title="Aufgabe deaktivieren?"
        message="Möchtest du diese Aufgabe wirklich deaktivieren? Sie kann später wieder aktiviert werden."
        confirmLabel="Deaktivieren"
        onCancel={() => setDeactivateId(null)}
        onConfirm={() => {
          if (deactivateId) void setTaskActive(deactivateId, false)
          setDeactivateId(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Aufgabe löschen?"
        message="Möchtest du diese Aufgabe wirklich löschen? Diese Aktion kann später nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) void removeTask(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
