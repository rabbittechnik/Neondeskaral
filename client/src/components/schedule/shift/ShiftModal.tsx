import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { ScheduleShift } from '../../../data/mockSchedule'
import { createLocalShiftId, toISODate } from '../../../data/mockSchedule'
import { Button } from '../../ui/Button'
import { ShiftForm } from './ShiftForm'
import type { ShiftEmployeeOption } from './EmployeeSelect'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { ConflictWarningBox } from './ConflictWarningBox'
import {
  collectShiftWarnings,
  validateRequiredFields,
  type ShiftDraft,
} from './shiftConflicts'
import { suggestedTimesForType } from './shiftDefaults'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  mode: Mode
  shift: ScheduleShift | null
  weekMonday: Date
  allShifts: ScheduleShift[]
  onClose: () => void
  onUpsert: (shift: ScheduleShift) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  getEmployeeDisplayName: (id: string) => string
  employeeSelectOptions: ShiftEmployeeOption[]
}

function draftFromShift(s: ScheduleShift): ShiftDraft {
  return {
    id: s.id,
    employeeId: s.employeeId,
    workAreaId: s.workAreaId,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    breakMinutes: s.breakMinutes,
    shiftType: s.shiftType,
    note: s.note,
    status: s.status,
    conflict: s.conflict,
  }
}

function emptyDraft(weekMonday: Date): ShiftDraft {
  const sug = suggestedTimesForType('frueh')
  return {
    workAreaId: '',
    date: toISODate(weekMonday),
    startTime: sug.start,
    endTime: sug.end,
    breakMinutes: 0,
    shiftType: 'frueh',
    note: '',
    status: 'Entwurf',
  }
}

function draftToShift(d: ShiftDraft): ScheduleShift {
  return {
    id: d.id ?? createLocalShiftId(),
    employeeId: d.employeeId?.trim() || undefined,
    workAreaId: d.workAreaId.trim(),
    date: d.date.trim(),
    startTime: d.shiftType === 'frei' ? '' : d.startTime.trim(),
    endTime: d.shiftType === 'frei' ? '' : d.endTime.trim(),
    breakMinutes: d.breakMinutes,
    shiftType: d.shiftType,
    note: d.note.trim(),
    status: d.status,
    color: undefined,
    conflict: d.conflict,
  }
}

export function ShiftModal({
  open,
  mode,
  shift,
  weekMonday,
  allShifts,
  onClose,
  onUpsert,
  onDelete,
  getEmployeeDisplayName,
  employeeSelectOptions,
}: Props) {
  const [form, setForm] = useState<ShiftDraft>(() => emptyDraft(weekMonday))
  const [requiredErrors, setRequiredErrors] = useState<string[]>([])
  const [blockedWarnings, setBlockedWarnings] = useState<string[]>([])
  const [blockedDraft, setBlockedDraft] = useState<ShiftDraft | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setRequiredErrors([])
    setBlockedWarnings([])
    setBlockedDraft(null)
    if (mode === 'edit' && shift) {
      setForm(draftFromShift(shift))
    } else {
      setForm(emptyDraft(weekMonday))
    }
  }, [open, mode, shift, weekMonday])

  const liveWarnings = useMemo(
    () => collectShiftWarnings(form, allShifts, getEmployeeDisplayName),
    [form, allShifts, getEmployeeDisplayName],
  )

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteOpen) onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose, deleteOpen])

  const handleTypeChange = (type: ScheduleShift['shiftType']) => {
    const sug = suggestedTimesForType(type)
    setForm((f) => ({
      ...f,
      shiftType: type,
      startTime: sug.start,
      endTime: sug.end,
    }))
  }

  const commit = async (draft: ShiftDraft, ignoreWarnings: boolean) => {
    const req = validateRequiredFields(draft)
    setRequiredErrors(req)
    if (req.length > 0) return

    const war = collectShiftWarnings(draft, allShifts, getEmployeeDisplayName)
    if (war.length > 0 && !ignoreWarnings) {
      setBlockedWarnings(war)
      setBlockedDraft(draft)
      return
    }

    try {
      await Promise.resolve(onUpsert(draftToShift(draft)))
      onClose()
    } catch {
      window.alert('Schicht konnte nicht gespeichert werden.')
    }
  }

  const tryCommit = (statusOverride?: ScheduleShift['status']) => {
    const draft: ShiftDraft = {
      ...form,
      status: statusOverride ?? form.status,
    }
    void commit(draft, false)
  }

  const forceCommit = () => {
    if (blockedDraft) {
      void commit(blockedDraft, true)
      return
    }
    void commit({ ...form, status: form.status }, true)
  }

  if (!open) return null

  const showBlockedBox = blockedWarnings.length > 0

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" aria-hidden />
        <div
          role="dialog"
          aria-modal
          aria-labelledby="shift-modal-title"
          className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-md)] border border-cyan-400/25 bg-[var(--bg-card)] shadow-[0_0_48px_rgba(34,211,238,0.08),0_0_1px_rgba(34,211,238,0.4),var(--shadow-card)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/5 px-5 py-4">
            <div>
              <h2
                id="shift-modal-title"
                className="text-lg font-semibold tracking-tight text-[var(--text-main)]"
              >
                {mode === 'create' ? 'Neue Schicht' : 'Schicht bearbeiten'}
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Lokale Planung · Farbe folgt automatisch dem Schichttyp
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-sm)] p-2 text-[var(--text-muted)] transition hover:bg-white/5 hover:text-[var(--text-main)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <ShiftForm
              values={form}
              onChange={(next) => {
                setForm(next)
                setBlockedWarnings([])
                setBlockedDraft(null)
              }}
              onShiftTypeChange={handleTypeChange}
              requiredErrors={requiredErrors}
              employeeOptions={employeeSelectOptions}
            />

            {liveWarnings.length > 0 && !showBlockedBox ? (
              <div className="mt-4">
                <ConflictWarningBox warnings={liveWarnings} />
              </div>
            ) : null}

            {showBlockedBox ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-medium text-orange-200/90">
                  Speichern wegen Hinweisen zunächst gestoppt — du kannst trotzdem fortfahren:
                </p>
                <ConflictWarningBox warnings={blockedWarnings} />
                <Button variant="outline" type="button" onClick={forceCommit}>
                  Trotzdem speichern
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 px-5 py-4">
            <Button variant="ghost" type="button" onClick={onClose}>
              Abbrechen
            </Button>
            {mode === 'edit' ? (
              <>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                >
                  Löschen
                </Button>
                <Button variant="primary" type="button" onClick={() => tryCommit()}>
                  Änderungen speichern
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" type="button" onClick={() => tryCommit('Entwurf')}>
                  Speichern
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => tryCommit('Veröffentlicht')}
                >
                  Speichern & veröffentlichen
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Schicht löschen"
        message="Möchtest du diese Schicht wirklich löschen?"
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          void (async () => {
            try {
              if (shift?.id) await Promise.resolve(onDelete(shift.id))
              setDeleteOpen(false)
              onClose()
            } catch {
              window.alert('Löschen fehlgeschlagen')
            }
          })()
        }}
      />
    </>
  )
}
