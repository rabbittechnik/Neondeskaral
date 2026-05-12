import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Absence, AbsenceStatus, AbsenceType } from '../../types/absence'
import { useEmployees } from '../../context/employees-context'
import { useAbsences } from '../../context/absences-context'
import { useScheduleShifts } from '../../context/schedule-shifts-context'
import { checkAbsenceConflicts } from '../../utils/absenceConflicts'
import { useStation } from '../../context/station-context'
import { ABSENCE_TYPE_LABELS } from './absenceLabels'
import { AbsenceConflictWarningBox } from './AbsenceConflictWarningBox'
import { Button } from '../ui/Button'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  mode: Mode
  absence: Absence | null
  onClose: () => void
  onSave: (a: Absence) => void
}

function emptyDraft(): Absence {
  return {
    id: '',
    employeeId: '',
    type: 'urlaub',
    startDate: '',
    endDate: '',
    halfDay: false,
    status: 'beantragt',
    comment: '',
    requestedAt: new Date().toISOString(),
  }
}

export function AbsenceModal({ open, mode, absence, onClose, onSave }: Props) {
  const { federalState } = useStation()
  const { employees } = useEmployees()
  const { absences, vacationBlocks } = useAbsences()
  const { shifts } = useScheduleShifts()
  const [form, setForm] = useState<Absence>(() => emptyDraft())
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setErrors([])
    if (mode === 'edit' && absence) setForm(structuredClone(absence))
    else setForm(emptyDraft())
  }, [open, mode, absence])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const conflicts = useMemo(() => {
    if (!form.employeeId || !form.startDate || !form.endDate) return []
    return checkAbsenceConflicts(
      {
        employeeId: form.employeeId,
        startDate: form.startDate,
        endDate: form.endDate,
        type: form.type,
      },
      {
        absences,
        vacationBlocks,
        shifts,
        employees,
        federalState,
        excludeAbsenceId: mode === 'edit' ? form.id : undefined,
      },
    )
  }, [form.employeeId, form.startDate, form.endDate, form.type, absences, vacationBlocks, shifts, employees, mode, form.id, federalState])

  const validate = (): string[] => {
    const err: string[] = []
    if (!form.employeeId.trim()) err.push('Mitarbeiter ist Pflicht.')
    if (!form.type) err.push('Typ ist Pflicht.')
    if (!form.startDate) err.push('Startdatum fehlt.')
    if (!form.endDate) err.push('Enddatum fehlt.')
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      err.push('Enddatum darf nicht vor dem Startdatum liegen.')
    return err
  }

  const submit = (approve: boolean) => {
    const v = validate()
    setErrors(v)
    if (v.length > 0) return
    const now = new Date().toISOString()
    const out: Absence = {
      ...form,
      status: approve ? 'genehmigt' : form.status,
      requestedAt: form.requestedAt || now,
      approvedBy: approve ? 'Station' : form.approvedBy,
      approvedAt: approve ? now : form.approvedAt,
    }
    onSave(out)
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">
            {mode === 'create' ? 'Neue Abwesenheit' : 'Abwesenheit bearbeiten'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-main)]"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-[var(--text-muted)]">
            Mitarbeiter *
            <select
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            >
              <option value="">— wählen —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            Typ *
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceType }))}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            >
              {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((t) => (
                <option key={t} value={t}>
                  {ABSENCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-[var(--text-muted)]">
              Start *
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              />
            </label>
            <label className="block text-xs text-[var(--text-muted)]">
              Ende *
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={form.halfDay}
              onChange={(e) => setForm((f) => ({ ...f, halfDay: e.target.checked }))}
            />
            Halbtägig
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            Kommentar
            <textarea
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            Status
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AbsenceStatus }))}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            >
              <option value="beantragt">Beantragt</option>
              <option value="genehmigt">Genehmigt</option>
              <option value="abgelehnt">Abgelehnt</option>
              <option value="storniert">Storniert</option>
            </select>
          </label>
          <p className="text-[10px] text-[var(--text-faint)]">
            Nachweis / Datei-Upload: später geplant (nicht aktiv).
          </p>
        </div>

        <AbsenceConflictWarningBox warnings={conflicts} />

        {errors.length > 0 ? (
          <ul className="mt-3 list-inside list-disc text-xs text-red-300">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="button" onClick={() => submit(false)}>
            {conflicts.length > 0 ? 'Trotzdem speichern' : 'Speichern'}
          </Button>
          <Button variant="outline" type="button" onClick={() => submit(true)}>
            {conflicts.length > 0 ? 'Trotzdem speichern & genehmigen' : 'Speichern & genehmigen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
