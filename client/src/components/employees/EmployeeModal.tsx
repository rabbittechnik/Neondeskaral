import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Employee } from '../../types/employee'
import { createEmployeeId } from '../../data/mockEmployees'
import { Button } from '../ui/Button'
import { EmployeeForm } from './EmployeeForm'
import { emptyEmployee } from './employeeDefaults'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  mode: Mode
  employee: Employee | null
  onClose: () => void
  onSaveCreate: (e: Employee) => void
  onSaveEdit: (e: Employee) => void
}

function validate(e: Employee): string[] {
  const err: string[] = []
  if (!e.firstName.trim()) err.push('Vorname fehlt.')
  if (!e.lastName.trim()) err.push('Nachname fehlt.')
  if (!e.displayName.trim()) err.push('Anzeigename fehlt.')
  if (!e.email.trim()) err.push('E-Mail fehlt.')
  if (e.workAreaIds.length === 0) err.push('Mindestens ein Arbeitsbereich.')
  return err
}

export function EmployeeModal({
  open,
  mode,
  employee,
  onClose,
  onSaveCreate,
  onSaveEdit,
}: Props) {
  const [form, setForm] = useState<Employee>(() => emptyEmployee())
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setErrors([])
    if (mode === 'edit' && employee) {
      setForm(structuredClone(employee))
    } else {
      setForm(emptyEmployee())
    }
  }, [open, mode, employee])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const submit = () => {
    const v = validate(form)
    setErrors(v)
    if (v.length > 0) return
    if (mode === 'create') {
      const id = form.id?.trim() ? form.id : createEmployeeId()
      onSaveCreate({ ...form, id })
    } else {
      onSaveEdit(form)
    }
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="employee-modal-title"
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-md)] border border-cyan-400/25 bg-[var(--bg-card)] shadow-[0_0_48px_rgba(34,211,238,0.1),var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2
              id="employee-modal-title"
              className="text-lg font-semibold text-[var(--text-main)]"
            >
              {mode === 'create' ? 'Neuer Mitarbeiter' : 'Mitarbeiter bearbeiten'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Lokale Verwaltung · ohne Server
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {errors.length > 0 ? (
            <div className="mb-4 rounded-[var(--radius-sm)] border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <ul className="list-inside list-disc">
                {errors.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <EmployeeForm value={form} onChange={setForm} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 px-5 py-4">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="button" onClick={submit}>
            {mode === 'create' ? 'Mitarbeiter speichern' : 'Änderungen speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}
