import { formatDaysDe, formatEuroDe, formatHoursDe } from './payrollReportTable'

export type PayrollDetailExtraRow = {
  employmentType?: string
  registeredHourlyWage?: number
  hourlyWage: number
  minimumWageNote?: string
  overtimeHours?: number
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance?: number
  vacationDays?: number
  paidVacationHours?: number
  paidOtherAbsenceHours?: number
  workPlanHours?: number
  totalHours?: number
  missingTimeEntriesDayCount?: number
  unplannedWorkDayCount?: number
}

function formatRegisteredHourly(registered?: number): string {
  if (registered == null) return '—'
  return formatEuroDe(registered)
}

type Props = {
  row: PayrollDetailExtraRow
  showEmployment?: boolean
  showAdvance?: boolean
  showSummaryHints?: boolean
}

export function PayrollDetailExtraFields({
  row,
  showEmployment = false,
  showAdvance = true,
  showSummaryHints = false,
}: Props) {
  return (
    <dl className="mb-4 grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {showEmployment && row.employmentType ? (
        <div>
          <dt className="text-xs text-[var(--text-faint)]">Beschäftigungsart</dt>
          <dd className="text-slate-200/90">{row.employmentType}</dd>
        </div>
      ) : null}
      {showSummaryHints ? (
        <>
          <div>
            <dt className="text-xs text-[var(--text-faint)]">Ohne Stempel</dt>
            <dd className="tabular-nums text-orange-200/90">{row.missingTimeEntriesDayCount ?? 0} Tage</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-faint)]">Ohne Plan</dt>
            <dd className="tabular-nums text-orange-200/90">{row.unplannedWorkDayCount ?? 0} Tage</dd>
          </div>
        </>
      ) : null}
      <div>
        <dt className="text-xs text-[var(--text-faint)]">Eingetr. Lohn</dt>
        <dd className="tabular-nums text-sky-200/90">{formatRegisteredHourly(row.registeredHourlyWage)}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-faint)]">Verwend. Lohn</dt>
        <dd className="tabular-nums text-sky-200/90">{formatEuroDe(row.hourlyWage)}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-faint)]">Hinweis</dt>
        <dd className="text-slate-300/90">{row.minimumWageNote?.trim() || '—'}</dd>
      </div>
      {(row.overtimeHours ?? 0) > 0 ? (
        <div>
          <dt className="text-xs text-[var(--text-faint)]">Überstunden</dt>
          <dd className="tabular-nums text-amber-200/90">{formatHoursDe(row.overtimeHours ?? 0)}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-xs text-[var(--text-faint)]">Mankogeld</dt>
        <dd className="tabular-nums text-orange-200/80">{formatEuroDe(row.mankogeld)}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-faint)]">VL</dt>
        <dd className="tabular-nums text-orange-200/80">{formatEuroDe(row.vl)}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-faint)]">Kassendif.</dt>
        <dd className="tabular-nums text-orange-200/80">{formatEuroDe(row.cashDifference)}</dd>
      </div>
      <div>
        <dt className="text-xs text-[var(--text-faint)]">Prämie</dt>
        <dd className="tabular-nums text-slate-200/90">{formatEuroDe(row.bonus)}</dd>
      </div>
      {showAdvance ? (
        <div>
          <dt className="text-xs text-[var(--text-faint)]">Vorschuss</dt>
          <dd className="tabular-nums text-orange-200/80">{formatEuroDe(row.advance ?? 0)}</dd>
        </div>
      ) : null}
      {row.vacationDays != null ? (
        <div>
          <dt className="text-xs text-[var(--text-faint)]">U-Tage</dt>
          <dd className="tabular-nums text-teal-200/90">{formatDaysDe(row.vacationDays)}</dd>
        </div>
      ) : null}
      {(row.paidVacationHours ?? 0) > 0 || (row.paidOtherAbsenceHours ?? 0) > 0 ? (
        <div className="sm:col-span-2">
          <dt className="text-xs text-[var(--text-faint)]">Urlaub / Abwesenheit (Std.)</dt>
          <dd className="text-emerald-200/90">
            {(row.paidVacationHours ?? 0) > 0 ? `Urlaub ${formatHoursDe(row.paidVacationHours ?? 0)}` : ''}
            {(row.paidOtherAbsenceHours ?? 0) > 0
              ? `${(row.paidVacationHours ?? 0) > 0 ? ' · ' : ''}sonst. bez. Abw. ${formatHoursDe(row.paidOtherAbsenceHours ?? 0)}`
              : ''}
          </dd>
        </div>
      ) : null}
      {row.workPlanHours != null && row.totalHours != null ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-xs text-[var(--text-faint)]">Stundenaufteilung</dt>
          <dd className="text-violet-200/90">
            Arbeit {formatHoursDe(row.workPlanHours)}
            {(row.paidVacationHours ?? 0) > 0 ? ` · Urlaub ${formatHoursDe(row.paidVacationHours ?? 0)}` : ''}
            {(row.paidOtherAbsenceHours ?? 0) > 0
              ? ` · sonst. bez. Abw. ${formatHoursDe(row.paidOtherAbsenceHours ?? 0)}`
              : ''}
            {` · Summe ${formatHoursDe(row.totalHours)}`}
          </dd>
        </div>
      ) : null}
    </dl>
  )
}
