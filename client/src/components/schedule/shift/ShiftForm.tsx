import type { ShiftTypeId } from '../../../data/mockSchedule'
import { EmployeeSelect, type ShiftEmployeeOption } from './EmployeeSelect'
import { WorkAreaSelect } from './WorkAreaSelect'
import { ShiftTypeSelect } from './ShiftTypeSelect'
import type { ShiftDraft } from './shiftConflicts'
import { inputClass, labelClass } from './fieldStyles'

type Props = {
  values: ShiftDraft
  onChange: (next: ShiftDraft) => void
  onShiftTypeChange: (type: ShiftTypeId) => void
  requiredErrors: string[]
  disabled?: boolean
  employeeOptions: ShiftEmployeeOption[]
  hideDate?: boolean
  hideStatus?: boolean
}

export function ShiftForm({
  values,
  onChange,
  onShiftTypeChange,
  requiredErrors,
  disabled,
  employeeOptions,
  hideDate,
  hideStatus,
}: Props) {
  return (
    <div className="space-y-4">
      {requiredErrors.length > 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-200/95">
          <ul className="list-inside list-disc space-y-0.5">
            {requiredErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <EmployeeSelect
          id="shift-employee"
          value={values.employeeId ?? ''}
          onChange={(employeeId) =>
            onChange({ ...values, employeeId: employeeId || undefined })
          }
          disabled={disabled}
          options={employeeOptions}
        />
        <WorkAreaSelect
          id="shift-area"
          value={values.workAreaId}
          onChange={(workAreaId) => onChange({ ...values, workAreaId })}
          disabled={disabled}
        />
      </div>

      <div className={`grid gap-4 ${hideDate ? '' : 'sm:grid-cols-2'}`}>
        {!hideDate ? (
          <div>
            <label htmlFor="shift-date" className={labelClass}>
              Datum
            </label>
            <input
              id="shift-date"
              type="date"
              className={inputClass}
              value={values.date}
              disabled={disabled}
              onChange={(e) => onChange({ ...values, date: e.target.value })}
            />
          </div>
        ) : null}
        <ShiftTypeSelect
          id="shift-type"
          value={values.shiftType}
          onChange={(t) => onShiftTypeChange(t)}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="shift-start" className={labelClass}>
            Startzeit
          </label>
          <input
            id="shift-start"
            type="time"
            className={inputClass}
            value={values.startTime}
            disabled={disabled || values.shiftType === 'frei'}
            onChange={(e) => onChange({ ...values, startTime: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="shift-end" className={labelClass}>
            Endzeit
          </label>
          <input
            id="shift-end"
            type="time"
            className={inputClass}
            value={values.endTime}
            disabled={disabled || values.shiftType === 'frei'}
            onChange={(e) => onChange({ ...values, endTime: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label htmlFor="shift-break" className={labelClass}>
          Pause (Minuten)
        </label>
        <input
          id="shift-break"
          type="number"
          min={0}
          max={180}
          className={`${inputClass} max-w-[8rem]`}
          value={values.breakMinutes}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...values,
              breakMinutes: Math.max(0, Number(e.target.value) || 0),
            })
          }
        />
      </div>

      {!hideStatus ? (
      <div>
        <span className={labelClass}>Status</span>
        <div className="flex flex-wrap gap-2">
          {(['Entwurf', 'Veröffentlicht'] as const).map((st) => (
            <button
              key={st}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...values, status: st })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                values.status === st
                  ? st === 'Veröffentlicht'
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                    : 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                  : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]/50 text-[var(--text-muted)] hover:border-cyan-400/35'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>
      ) : null}

      <div>
        <label htmlFor="shift-note" className={labelClass}>
          Notiz
        </label>
        <textarea
          id="shift-note"
          rows={3}
          className={`${inputClass} resize-y min-h-[5rem]`}
          placeholder="Optional …"
          value={values.note}
          disabled={disabled}
          onChange={(e) => onChange({ ...values, note: e.target.value })}
        />
      </div>
    </div>
  )
}
