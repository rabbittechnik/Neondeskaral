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
  formatDiffHoursDe,
  formatEuroDe,
  formatHoursDe,
} from './payrollReportTable'

export type PayrollSummaryTableRow = {
  employeeId: string
  employeeName: string
  scheduleHoursTotal: number
  timeTrackingHoursTotal: number
  usedHoursTotal: number
  differenceHours: number
  extraUnplannedHours: number
  missingTimeEntriesDayCount: number
  unplannedWorkDayCount: number
  vacationDays: number
  hourlyWage: number
  basePay: number
  supplementsTotal: number
  advance: number
  total: number
  paidVacationHours: number
  paidOtherAbsenceHours?: number
  messages?: string[]
}

export type PayrollSummaryTableTotals = {
  scheduleHours: number
  timeTrackingHours: number
  usedHours: number
  differenceHours: number
  extraUnplannedHours: number
  vacationDays: number
  basePay: number
  supplementsTotal: number
  advance: number
  total: number
}

type Props = {
  rows: PayrollSummaryTableRow[]
  totals: PayrollSummaryTableTotals
  selected: Set<string>
  onToggleRow: (id: string) => void
  onToggleAll: () => void
  onOpenDetails: (employeeId: string) => void
}

const thStyle = (minW: number) => ({ minWidth: minW })

export function PayrollSummaryMainTable({
  rows,
  totals,
  selected,
  onToggleRow,
  onToggleAll,
  onOpenDetails,
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
            <th className={payrollTh('plan')} style={thStyle(110)}>
              Plan
            </th>
            <th className={payrollTh('time')} style={thStyle(120)}>
              Erfasst
            </th>
            <th className={payrollTh('used')} style={thStyle(120)}>
              Verwendet
            </th>
            <th className={payrollTh('diff')} style={thStyle(100)}>
              Differenz
            </th>
            <th className={payrollTh('extra')} style={thStyle(100)}>
              Zusatz
            </th>
            <th className={payrollTh('vacation')} style={thStyle(90)}>
              U-Tage
            </th>
            <th className={payrollTh('wage')} style={thStyle(110)}>
              Lohn
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
              <td className={payrollTd('plan')}>{formatHoursDe(r.scheduleHoursTotal)}</td>
              <td className={payrollTd('time')}>{formatHoursDe(r.timeTrackingHoursTotal)}</td>
              <td className={payrollTd('used')}>
                <span className="font-medium">{formatHoursDe(r.usedHoursTotal)}</span>
              </td>
              <td className={payrollTd('diff')}>{formatDiffHoursDe(r.differenceHours)}</td>
              <td className={payrollTd('extra')}>{formatHoursDe(r.extraUnplannedHours)}</td>
              <td className={payrollTd('vacation')}>{formatDaysDe(r.vacationDays)}</td>
              <td className={payrollTd('wage')}>{formatEuroDe(r.hourlyWage)}</td>
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
            <td className={`${payrollTd('plan')} py-3 font-semibold`}>{formatHoursDe(totals.scheduleHours)}</td>
            <td className={`${payrollTd('time')} py-3 font-semibold`}>{formatHoursDe(totals.timeTrackingHours)}</td>
            <td className={`${payrollTd('used')} py-3 font-semibold`}>{formatHoursDe(totals.usedHours)}</td>
            <td className={`${payrollTd('diff')} py-3 font-semibold`}>{formatDiffHoursDe(totals.differenceHours)}</td>
            <td className={`${payrollTd('extra')} py-3 font-semibold`}>{formatHoursDe(totals.extraUnplannedHours)}</td>
            <td className={`${payrollTd('vacation')} py-3 font-semibold`}>{formatDaysDe(totals.vacationDays)}</td>
            <td className="px-3 py-3" />
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
