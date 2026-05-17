import { Check } from 'lucide-react'
import type { Employee } from '../../../types/employee'
import type { ReserveConditions } from '../../../types/employeePlanning'
import {
  PREFERRED_SHIFT_POLICY_OPTIONS,
  WEEKEND_DAY_PREFERENCE_OPTIONS,
  defaultWeekdayAvailability,
} from '../../../types/employeePlanning'
import { labelClass, inputClass } from '../../schedule/shift/fieldStyles'
import { WeekdayAvailabilityMatrix } from './WeekdayAvailabilityMatrix'

type Props = {
  value: Employee
  onChange: (next: Employee) => void
  disabled?: boolean
}

const boolChip =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50'

function numOrUndef(raw: string): number | undefined {
  if (raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined
}

export function EmployeePlanningRulesCards({ value, onChange, disabled }: Props) {
  const patch = (p: Partial<Employee>) => onChange({ ...value, ...p })
  const reserve = value.reserveConditions ?? {}
  const patchReserve = (p: Partial<ReserveConditions>) =>
    patch({ reserveConditions: { ...reserve, ...p } })

  const weekdayAvailability = value.weekdayAvailability ?? defaultWeekdayAvailability()

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] border border-cyan-500/12 bg-[var(--bg-card)]/40 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/85">
          Monatliche Wünsche
        </h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="desired-shifts-mo">
              Gewünschte Arbeitstage / Monat
            </label>
            <input
              id="desired-shifts-mo"
              type="number"
              min={0}
              max={31}
              disabled={disabled}
              className={inputClass}
              placeholder="—"
              value={value.desiredShiftsPerMonth ?? ''}
              onChange={(e) => patch({ desiredShiftsPerMonth: numOrUndef(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="min-shifts-mo">
              Minimum Arbeitstage / Monat
            </label>
            <input
              id="min-shifts-mo"
              type="number"
              min={0}
              max={31}
              disabled={disabled}
              className={inputClass}
              placeholder="—"
              value={value.minShiftsPerMonth ?? ''}
              onChange={(e) => patch({ minShiftsPerMonth: numOrUndef(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="max-shifts-mo">
              Maximale Arbeitstage / Monat
            </label>
            <input
              id="max-shifts-mo"
              type="number"
              min={0}
              max={31}
              disabled={disabled}
              className={inputClass}
              placeholder="—"
              value={value.maxShiftsPerMonth ?? ''}
              onChange={(e) => patch({ maxShiftsPerMonth: numOrUndef(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="desired-weekends-mo">
              Gewünschte Wochenenden / Monat
            </label>
            <input
              id="desired-weekends-mo"
              type="number"
              min={0}
              max={5}
              disabled={disabled}
              className={inputClass}
              placeholder="—"
              value={value.desiredWeekendsPerMonth ?? ''}
              onChange={(e) => patch({ desiredWeekendsPerMonth: numOrUndef(e.target.value) })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="weekend-day-pref">
              Wochenend-Tag
            </label>
            <select
              id="weekend-day-pref"
              disabled={disabled}
              className={inputClass}
              value={value.weekendDayPreference ?? 'either'}
              onChange={(e) =>
                patch({
                  weekendDayPreference: e.target.value as Employee['weekendDayPreference'],
                })
              }
            >
              {WEEKEND_DAY_PREFERENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-cyan-500/12 bg-[var(--bg-card)]/40 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/85">
          Bevorzugte Schichtart (Richtlinie)
        </h4>
        <select
          disabled={disabled}
          className={`${inputClass} mt-2`}
          value={value.preferredShiftPolicy ?? 'any'}
          onChange={(e) =>
            patch({ preferredShiftPolicy: e.target.value as Employee['preferredShiftPolicy'] })
          }
        >
          {PREFERRED_SHIFT_POLICY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Ergänzt die Chip-Auswahl unten; der Assistent wertet beides im Bewertungssystem.
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-cyan-500/12 bg-[var(--bg-card)]/40 p-4">
        <WeekdayAvailabilityMatrix
          value={weekdayAvailability}
          onChange={(weekdayAvailability) => patch({ weekdayAvailability })}
          disabled={disabled}
        />
      </div>

      <div className="rounded-[var(--radius-md)] border border-amber-500/20 bg-amber-500/5 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
          Reserve-Einsatz
        </h4>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Außerhalb der normalen Wunschzeiten nur unter den gewählten Bedingungen — mit Hinweis im
          Schichtplan-Assistenten.
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => patch({ reserveEnabled: !value.reserveEnabled })}
          className={`${boolChip} mt-3 ${
            value.reserveEnabled
              ? 'border-amber-400/55 bg-amber-500/15 text-amber-100'
              : 'border-[var(--border-strong)] bg-[var(--bg-card)]/50 text-[var(--text-muted)]'
          }`}
        >
          {value.reserveEnabled ? <Check className="h-3 w-3" aria-hidden /> : null}
          Reserve außerhalb Wunschzeiten erlaubt
        </button>

        {value.reserveEnabled ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ['staffShortage', 'Nur bei Personalmangel'],
                ['monthHoursFree', 'Nur wenn Monatsstunden frei'],
                ['mainStaffAbsent', 'Nur wenn Hauptpersonal fehlt'],
                ['manualConfirmOnly', 'Nur nach manueller Bestätigung'],
                ['warnNotAuto', 'Warnhinweis, nicht blind einplanen'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => patchReserve({ [key]: !reserve[key] })}
                className={`${boolChip} ${
                  reserve[key]
                    ? 'border-amber-400/55 bg-amber-500/15 text-amber-100'
                    : 'border-[var(--border-strong)] bg-[var(--bg-card)]/50 text-[var(--text-muted)]'
                }`}
              >
                {reserve[key] ? <Check className="h-3 w-3" aria-hidden /> : null}
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
