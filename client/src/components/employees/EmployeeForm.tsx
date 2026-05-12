import type { Employee, EmployeeHRStatus, EmploymentType } from '../../types/employee'
import { WORK_AREA_DEFINITIONS } from '../../data/mockEmployees'
import { inputClass, labelClass, selectClass } from '../schedule/shift/fieldStyles'
import { ColorPickerField } from './ColorPickerField'
import { STATUS_LABELS, EMPLOYMENT_LABELS } from './employeeLabels'

type Props = {
  value: Employee
  onChange: (next: Employee) => void
  disabled?: boolean
}

const employmentOptions: EmploymentType[] = [
  'vollzeit',
  'teilzeit',
  'minijob',
  'aushilfe',
  'schueler',
  'sonstige',
]

const statusOptions: EmployeeHRStatus[] = ['aktiv', 'inaktiv', 'urlaub', 'krank']

export function EmployeeForm({ value, onChange, disabled }: Props) {
  const patch = (p: Partial<Employee>) => onChange({ ...value, ...p })

  const toggleArea = (id: string) => {
    const set = new Set(value.workAreaIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    patch({ workAreaIds: Array.from(set) })
  }

  return (
    <div className="grid max-h-[min(70vh,720px)] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Stammdaten
        </h3>
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-fn">
          Vorname
        </label>
        <input
          id="emp-fn"
          className={inputClass}
          disabled={disabled}
          value={value.firstName}
          onChange={(e) => patch({ firstName: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-ln">
          Nachname
        </label>
        <input
          id="emp-ln"
          className={inputClass}
          disabled={disabled}
          value={value.lastName}
          onChange={(e) => patch({ lastName: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="emp-dn">
          Anzeigename
        </label>
        <input
          id="emp-dn"
          className={inputClass}
          disabled={disabled}
          value={value.displayName}
          onChange={(e) => patch({ displayName: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-mail">
          E-Mail
        </label>
        <input
          id="emp-mail"
          type="email"
          className={inputClass}
          disabled={disabled}
          value={value.email}
          onChange={(e) => patch({ email: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-phone">
          Telefon
        </label>
        <input
          id="emp-phone"
          className={inputClass}
          disabled={disabled}
          value={value.phone}
          onChange={(e) => patch({ phone: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-bd">
          Geburtstag
        </label>
        <input
          id="emp-bd"
          type="date"
          className={inputClass}
          disabled={disabled}
          value={value.birthday}
          onChange={(e) => patch({ birthday: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-start">
          Eintrittsdatum
        </label>
        <input
          id="emp-start"
          type="date"
          className={inputClass}
          disabled={disabled}
          value={value.startDate}
          onChange={(e) => patch({ startDate: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-end">
          Austritt (optional)
        </label>
        <input
          id="emp-end"
          type="date"
          className={inputClass}
          disabled={disabled}
          value={value.endDate ?? ''}
          onChange={(e) => patch({ endDate: e.target.value || undefined })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-role">
          Rolle
        </label>
        <input
          id="emp-role"
          className={inputClass}
          disabled={disabled}
          value={value.role}
          onChange={(e) => patch({ role: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-et">
          Beschäftigungsart
        </label>
        <select
          id="emp-et"
          className={selectClass}
          disabled={disabled}
          value={value.employmentType}
          onChange={(e) => patch({ employmentType: e.target.value as EmploymentType })}
        >
          {employmentOptions.map((k) => (
            <option key={k} value={k}>
              {EMPLOYMENT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-wh">
          Wochenstunden (Soll)
        </label>
        <input
          id="emp-wh"
          type="number"
          min={0}
          max={60}
          step={0.5}
          className={inputClass}
          disabled={disabled}
          value={value.weeklyHours}
          onChange={(e) => patch({ weeklyHours: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-mh">
          Monatsstunden (Anzeige / Dummy)
        </label>
        <input
          id="emp-mh"
          type="number"
          min={0}
          step={0.25}
          className={inputClass}
          disabled={disabled}
          value={value.monthlyHours}
          onChange={(e) => patch({ monthlyHours: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-wage">
          Stundenlohn (€)
        </label>
        <input
          id="emp-wage"
          type="number"
          min={0}
          step={0.01}
          className={inputClass}
          disabled={disabled}
          value={value.hourlyWage}
          onChange={(e) => patch({ hourlyWage: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-msal">
          Monatsgehalt optional (€)
        </label>
        <input
          id="emp-msal"
          type="number"
          min={0}
          step={1}
          className={inputClass}
          disabled={disabled}
          value={value.monthlySalary ?? ''}
          placeholder="—"
          onChange={(e) =>
            patch({
              monthlySalary: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-vtot">
          Urlaubstage / Jahr
        </label>
        <input
          id="emp-vtot"
          type="number"
          min={0}
          className={inputClass}
          disabled={disabled}
          value={value.vacationDaysTotal}
          onChange={(e) => patch({ vacationDaysTotal: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-vused">
          Urlaub genommen
        </label>
        <input
          id="emp-vused"
          type="number"
          min={0}
          className={inputClass}
          disabled={disabled}
          value={value.vacationDaysUsed}
          onChange={(e) => {
            const used = Number(e.target.value) || 0
            patch({
              vacationDaysUsed: used,
              remainingVacationDays: Math.max(0, value.vacationDaysTotal - used),
            })
          }}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-vrem">
          Resturlaub
        </label>
        <input
          id="emp-vrem"
          type="number"
          min={0}
          className={inputClass}
          disabled={disabled}
          value={value.remainingVacationDays}
          onChange={(e) =>
            patch({ remainingVacationDays: Number(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-st">
          Status
        </label>
        <select
          id="emp-st"
          className={selectClass}
          disabled={disabled}
          value={value.status}
          onChange={(e) => patch({ status: e.target.value as EmployeeHRStatus })}
        >
          {statusOptions.map((k) => (
            <option key={k} value={k}>
              {STATUS_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="emp-av">
          Avatar-URL (optional)
        </label>
        <input
          id="emp-av"
          className={inputClass}
          disabled={disabled}
          value={value.avatar ?? ''}
          placeholder="https://…"
          onChange={(e) => patch({ avatar: e.target.value || undefined })}
        />
      </div>
      <div className="sm:col-span-2">
        <ColorPickerField
          value={value.color}
          onChange={(c) => patch({ color: c })}
          disabled={disabled}
        />
      </div>
      <div className="sm:col-span-2">
        <span className={labelClass}>Arbeitsbereiche</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORK_AREA_DEFINITIONS.map((w) => {
            const on = value.workAreaIds.includes(w.id)
            return (
              <button
                key={w.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleArea(w.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  on
                    ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                    : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]/50 text-[var(--text-muted)] hover:border-cyan-400/25'
                }`}
              >
                {w.shortCode} · {w.name}
              </button>
            )
          })}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="emp-notes">
          Notizen
        </label>
        <textarea
          id="emp-notes"
          rows={3}
          className={`${inputClass} min-h-[4.5rem] resize-y`}
          disabled={disabled}
          value={value.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>
    </div>
  )
}
