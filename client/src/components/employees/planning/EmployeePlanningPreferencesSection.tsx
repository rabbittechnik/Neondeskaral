import { Check } from 'lucide-react'
import type { Employee } from '../../../types/employee'
import { labelClass, inputClass } from '../../schedule/shift/fieldStyles'
import { PlanningNotesField } from './PlanningNotesField'
import { ShiftPreferenceChips } from './ShiftPreferenceChips'
import { WorkDayPreferenceChips } from './WorkDayPreferenceChips'
import { EmployeePlanningRulesCards } from './EmployeePlanningRulesCards'

type Props = {
  value: Employee
  onChange: (next: Employee) => void
  disabled?: boolean
}

const boolChip =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50'

export function EmployeePlanningPreferencesSection({ value, onChange, disabled }: Props) {
  const patch = (p: Partial<Employee>) => onChange({ ...value, ...p })

  return (
    <div className="space-y-5 rounded-[var(--radius-md)] border border-cyan-500/15 bg-[var(--bg-elevated)]/25 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
        Schichtwünsche & Einsatzregeln
      </h3>
      <p className="text-[11px] text-[var(--text-muted)]">
        Erweiterte Wünsche und Reserve-Regeln — der Assistent bewertet weich; hart bleiben Abwesenheit
        und das Monatsstunden-Limit aus dem Profil.
      </p>

      <EmployeePlanningRulesCards value={value} onChange={onChange} disabled={disabled} />

      <div className="border-t border-[var(--border-subtle)] pt-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Klassische Chips (optional)
        </h4>
        <p className="mt-1 mb-3 text-[10px] text-[var(--text-muted)]">
          Bestehende Einstellungen bleiben erhalten und werden mit den neuen Regeln kombiniert.
        </p>
      </div>

      <div>
        <span className={labelClass}>Bevorzugte Schichtarten</span>
        <div className="mt-2">
          <ShiftPreferenceChips
            value={value.preferredShiftTypes ?? []}
            onChange={(preferredShiftTypes) => patch({ preferredShiftTypes })}
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <span className={labelClass}>Grundsätzlich möglich</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ canWorkWeekends: !(value.canWorkWeekends ?? true) })}
            className={`${boolChip} ${
              value.canWorkWeekends ?? true
                ? 'border-emerald-400/55 bg-emerald-500/15 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-card)]/50 text-[var(--text-muted)]'
            }`}
          >
            {value.canWorkWeekends ?? true ? <Check className="h-3 w-3" aria-hidden /> : null}
            Wochenende möglich
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => patch({ canWorkHolidays: !(value.canWorkHolidays ?? true) })}
            className={`${boolChip} ${
              value.canWorkHolidays ?? true
                ? 'border-emerald-400/55 bg-emerald-500/15 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-card)]/50 text-[var(--text-muted)]'
            }`}
          >
            {value.canWorkHolidays ?? true ? <Check className="h-3 w-3" aria-hidden /> : null}
            Feiertage möglich
          </button>
        </div>
      </div>

      <div>
        <span className={labelClass}>Bevorzugte Arbeitstage</span>
        <div className="mt-2">
          <WorkDayPreferenceChips
            value={value.preferredWorkDays ?? []}
            onChange={(preferredWorkDays) => patch({ preferredWorkDays })}
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <span className={labelClass}>Wenn möglich nicht</span>
        <div className="mt-2">
          <WorkDayPreferenceChips
            value={value.notPreferredWorkDays ?? []}
            onChange={(notPreferredWorkDays) => patch({ notPreferredWorkDays })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="max-pref-days">
            Max. bevorzugte Arbeitstage / Woche
          </label>
          <input
            id="max-pref-days"
            type="number"
            min={0}
            max={7}
            step={1}
            disabled={disabled}
            placeholder="—"
            className={inputClass}
            value={value.maxPreferredDaysPerWeek ?? ''}
            onChange={(e) =>
              patch({
                maxPreferredDaysPerWeek:
                  e.target.value === '' ? undefined : Math.min(7, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="max-weekly-h">
            Max. Stunden / Woche (optional)
          </label>
          <input
            id="max-weekly-h"
            type="number"
            min={0}
            max={60}
            step={0.5}
            disabled={disabled}
            placeholder="—"
            className={inputClass}
            value={value.maxWeeklyHours ?? ''}
            onChange={(e) =>
              patch({
                maxWeeklyHours: e.target.value === '' ? undefined : Number(e.target.value) || undefined,
              })
            }
          />
        </div>
      </div>

      <PlanningNotesField
        value={value.planningNotes ?? ''}
        onChange={(planningNotes) => patch({ planningNotes })}
        disabled={disabled}
      />
    </div>
  )
}
