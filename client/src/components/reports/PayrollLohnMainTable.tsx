import { Button } from '../ui/Button'
import {
  PayrollTableScroll,
  PAYROLL_TABLE_MAIN,
  PAYROLL_ROW,
  PAYROLL_TFOOT,
  PAYROLL_TD_EMPLOYEE,
  payrollTh,
  payrollTd,
  formatDaysDe,
  formatEuroDe,
  formatHoursDe,
} from './payrollReportTable'

export type PayrollLohnTableRow = {
  employeeId: string
  employeeName: string
  totalHours: number
  workPlanHours?: number
  paidVacationHours?: number
  paidOtherAbsenceHours?: number
  overtimeHours: number
  vacationDays: number
  basePay: number
  supplementsTotal: number
  advance: number
  total: number
  messages?: string[]
}

export type PayrollLohnTableTotals = {
  totalHours: number
  overtimeHours: number
  vacationDays: number
  basePay: number
  supplementsTotal: number
  advance: number
  total: number
}

type Props = {
  rows: PayrollLohnTableRow[]
  totals: PayrollLohnTableTotals
  selected: Set<string>
  onToggleRow: (id: string) => void
  onToggleAll: () => void
  onOpenDetails: (employeeId: string) => void
  hoursSublineLabel?: 'Schichten' | 'Gestempelt'
}

const thStyle = (minW: number) => ({ minWidth: minW })

function HoursSubline({
  r,
  label,
}: {
  r: PayrollLohnTableRow
  label: 'Schichten' | 'Gestempelt'
}) {
  if (r.workPlanHours == null) return null
  if (
    !(r.paidVacationHours != null && r.paidVacationHours > 0) &&
    !((r.paidOtherAbsenceHours ?? 0) > 0) &&
    r.workPlanHours === r.totalHours
  ) {
    return null
  }
  return (
    <div className="mt-1 text-xs font-normal leading-snug text-[var(--text-faint)]">
      {label} {formatHoursDe(r.workPlanHours)}
      {(r.paidVacationHours ?? 0) > 0 ? ` · Urlaub ${formatHoursDe(r.paidVacationHours ?? 0)}` : ''}
      {(r.paidOtherAbsenceHours ?? 0) > 0 ? ` · sonst. bez. Abw. ${formatHoursDe(r.paidOtherAbsenceHours ?? 0)}` : ''}
    </div>
  )
}

export function PayrollLohnMainTable({
  rows,
  totals,
  selected,
  onToggleRow,
  onToggleAll,
  onOpenDetails,
  hoursSublineLabel = 'Schichten',
}: Props) {
  return (
    <PayrollTableScroll>
      <table className={PAYROLL_TABLE_MAIN}>
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 text-left">
            <th className="w-10 px-2 py-3 print:hidden" style={thStyle(40)}>
              <input
                type="checkbox"
                aria-label="Alle auswählen"
                checked={selected.size === rows.length && rows.length > 0}
                onChange={onToggleAll}
              />
            </th>
            <th className={`${payrollTh('employee', 'left')} employee-col`} style={thStyle(170)}>
              Mitarbeiter
            </th>
            <th className={payrollTh('time')} style={thStyle(120)}>
              Stunden
            </th>
            <th className={payrollTh('diff')} style={thStyle(100)}>
              Überstd.
            </th>
            <th className={payrollTh('vacation')} style={thStyle(90)}>
              U-Tage
            </th>
            <th className={payrollTh('base')} style={thStyle(120)}>
              Grundlohn
            </th>
            <th className={payrollTh('supplements')} style={thStyle(120)}>
              Zuschläge
            </th>
            <th className={payrollTh('deduction')} style={thStyle(110)}>
              Vorschuss
            </th>
            <th className={`${payrollTh('total')} font-bold`} style={thStyle(130)}>
              Summe
            </th>
            <th className={`${payrollTh('muted', 'left')} print:hidden`} style={thStyle(100)}>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employeeId} className={PAYROLL_ROW}>
              <td className="px-2 py-3 print:hidden">
                <input
                  type="checkbox"
                  checked={selected.has(r.employeeId)}
                  onChange={() => onToggleRow(r.employeeId)}
                  aria-label={`Auswahl ${r.employeeName}`}
                />
              </td>
              <td className={PAYROLL_TD_EMPLOYEE}>
                <span className="text-cyan-300">{r.employeeName}</span>
                {r.messages?.length ? (
                  <div className="mt-1 max-w-[14rem] text-xs font-normal leading-snug text-amber-200/90">
                    {r.messages.join(' · ')}
                  </div>
                ) : null}
              </td>
              <td className={payrollTd('time')}>
                <span className="font-medium">{formatHoursDe(r.totalHours)}</span>
                <HoursSubline r={r} label={hoursSublineLabel} />
              </td>
              <td className={payrollTd('diff')}>
                {r.overtimeHours > 0 ? formatHoursDe(r.overtimeHours) : '—'}
              </td>
              <td className={payrollTd('vacation')}>{formatDaysDe(r.vacationDays)}</td>
              <td className={payrollTd('base')}>{formatEuroDe(r.basePay)}</td>
              <td className={payrollTd('supplements')}>{formatEuroDe(r.supplementsTotal)}</td>
              <td className={payrollTd('deduction')}>{formatEuroDe(r.advance)}</td>
              <td className={`${payrollTd('total')} text-base font-semibold`}>{formatEuroDe(r.total)}</td>
              <td className="px-3 py-3 print:hidden">
                <Button
                  type="button"
                  variant="outline"
                  className="whitespace-nowrap px-2.5 py-1.5 text-xs"
                  onClick={() => onOpenDetails(r.employeeId)}
                >
                  Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={PAYROLL_TFOOT}>
            <td className="py-3 print:hidden" />
            <td className="employee-col px-3 py-3 text-sm font-bold text-[var(--text-main)]">Summe</td>
            <td className={`${payrollTd('time')} py-3 font-semibold`}>{formatHoursDe(totals.totalHours)}</td>
            <td className={`${payrollTd('diff')} py-3 font-semibold`}>
              {totals.overtimeHours > 0 ? formatHoursDe(totals.overtimeHours) : '—'}
            </td>
            <td className={`${payrollTd('vacation')} py-3 font-semibold`}>{formatDaysDe(totals.vacationDays)}</td>
            <td className={`${payrollTd('base')} py-3 font-semibold`}>{formatEuroDe(totals.basePay)}</td>
            <td className={`${payrollTd('supplements')} py-3 font-semibold`}>{formatEuroDe(totals.supplementsTotal)}</td>
            <td className={`${payrollTd('deduction')} py-3 font-semibold`}>{formatEuroDe(totals.advance)}</td>
            <td className={`${payrollTd('total')} py-3 text-base font-bold`}>{formatEuroDe(totals.total)}</td>
            <td className="print:hidden" />
          </tr>
        </tfoot>
      </table>
    </PayrollTableScroll>
  )
}
