import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Task } from '../../types/task'
import { useEmployees } from '../../context/employees-context'
import { useWorkAreas } from '../../context/work-areas-context'
import { parseTimeToMinutes, toISODateLocal } from '../../utils/taskUtils'
import { Button } from '../ui/Button'
import { TaskForm } from './TaskForm'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  task: Task | null
  onClose: () => void
  onSave: (t: Task) => void | Promise<void>
}

function newDraft(): Task {
  const now = new Date().toISOString()
  return {
    id: '',
    title: '',
    description: '',
    workAreaId: 'kasse',
    assignedType: 'all',
    recurrenceType: 'daily',
    startDate: toISODateLocal(new Date()),
    startTime: '08:00',
    endTime: '16:00',
    confirmRequired: true,
    controlRequired: false,
    mandatory: true,
    priority: 'normal',
    active: true,
    createdBy: 'Mathias Raselowski',
    createdAt: now,
    updatedAt: now,
  }
}

export function TaskModal({ open, mode, task, onClose, onSave }: Props) {
  const { employees } = useEmployees()
  const { definitions: workAreas } = useWorkAreas()
  const [draft, setDraft] = useState<Task>(() => newDraft())
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setErrors([])
    if (mode === 'edit' && task) setDraft(structuredClone(task))
    else setDraft(newDraft())
  }, [open, mode, task])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const patch = (p: Partial<Task>) => setDraft((d) => ({ ...d, ...p }))

  const submit = async () => {
    const err: string[] = []
    if (!draft.title.trim()) err.push('Titel ist Pflicht.')
    if (!draft.workAreaId) err.push('Arbeitsbereich wählen.')
    if (parseTimeToMinutes(draft.endTime) <= parseTimeToMinutes(draft.startTime))
      err.push('Ende muss nach Start liegen (gleicher Tag).')
    if (draft.recurrenceType === 'weekly' && !(draft.weekdays?.length ?? 0))
      err.push('Mindestens einen Wochentag wählen.')
    setErrors(err)
    if (err.length) return
    try {
      await Promise.resolve(onSave(draft))
      onClose()
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Speichern fehlgeschlagen'])
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div className="relative z-10 flex max-h-[92vh] w-[min(95vw,72rem)] max-w-[min(95vw,72rem)] flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">
            {mode === 'create' ? 'Aufgabe erstellen' : 'Aufgabe bearbeiten'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-white/10"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <TaskForm value={draft} onChange={patch} employees={employees} workAreas={workAreas} />
          {errors.length ? (
            <ul className="mt-3 list-inside list-disc text-xs text-red-300">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="button" onClick={() => void submit()}>
            {mode === 'create' ? 'Aufgabe speichern' : 'Änderungen speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}
