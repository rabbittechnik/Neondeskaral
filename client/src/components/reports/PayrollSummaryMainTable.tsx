import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import {
  PayrollTableScroll,
  PAYROLL_TABLE_SUMMARY,
  PAYROLL_ROW,
  PAYROLL_TFOOT,
  PAYROLL_THEAD_ROW,
  PAYROLL_TD_EMPLOYEE,
  PAYROLL_MIN_W,
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
  /** Zeitraum für Link zur Detailseite */
  periodFrom: string
  periodTo: string
}

const mw = (n: number) => ({ minWidth: n })

export function PayrollSummaryMainTable({
  rows,
  totals,
  selected,
  onToggleRow,
  onToggleAll,
  onOpenDetails,
  periodFrom,
  periodTo,
}: Props) {
  return (
    <PayrollTableScroll>
      <table className={PAYROLL_TABLE_SUMMARY}>
        <thead>
          <tr className={PAYROLL_THEAD_ROW}>
            <th className="w-10 px-2 py-3 print:hidden" style={mw(PAYROLL_MIN_W.checkbox)}>
              <input
                type="checkbox"
                aria-label="Alle auswählen"
                checked={selected.size === rows.length && rows.length > 0}
                onChange={onToggleAll}
              />
            </th>
            <th className={`${payrollTh('employee', 'left')} employee-col`} style={mw(PAYROLL_MIN_W.employee)}>
              Mitarbeiter
            </th>
            <th className={payrollTh('plan')} style={mw(PAYROLL_MIN_W.hours)}>
              Plan
            </th>
            <th className={payrollTh('time')} style={mw(PAYROLL_MIN_W.hours)}>
              Erfasst
            </th>
            <th className={payrollTh('used')} style={mw(PAYROLL_MIN_W.hours)}>
              Verwendet
            </th>
            <th className={payrollTh('diff')} style={mw(PAYROLL_MIN_W.diff)}>
              Differenz
            </th>
            <th className={payrollTh('extra')} style={mw(PAYROLL_MIN_W.diff)}>
              Zusatz
            </th>
            <th className={payrollTh('vacation')} style={mw(PAYROLL_MIN_W.vacationDays)}>
              U-Tage
            </th>
            <th className={payrollTh('wage')} style={mw(PAYROLL_MIN_W.wage)}>
              Stundenlohn
            </th>
            <th className={payrollTh('base')} style={mw(PAYROLL_MIN_W.base)}>
              Grundlohn
            </th>
            <th className={payrollTh('supplements')} style={mw(PAYROLL_MIN_W.supplements)}>
              Zuschläge
            </th>
            <th
              className={`${payrollTh('deduction')} payroll-col-screen-only hidden xl:table-cell`}
              style={mw(PAYROLL_MIN_W.deduction)}
            >
              Vorschuss
            </th>
            <th className={`${payrollTh('total')} font-bold`} style={mw(PAYROLL_MIN_W.total)}>
              Summe
            </th>
            <th className={`${payrollTh('muted', 'left')} print:hidden`} style={mw(PAYROLL_MIN_W.details)}>
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employeeId} className={PAYROLL_ROW}>
              <td className="px-2 py-2.5 print:hidden">
                <input
                  type="checkbox"
                  checked={selected.has(r.employeeId)}
                  onChange={() => onToggleRow(r.employeeId)}
                  aria-label={`Auswahl ${r.employeeName}`}
                />
              </td>
              <td className={PAYROLL_TD_EMPLOYEE}>
                <Link
                  to={`/reports/payroll-summary/employee/${encodeURIComponent(r.employeeId)}?from=${periodFrom}&to=${periodTo}`}
                  className="text-cyan-300 hover:text-cyan-200 hover:underline"
                >
                  {r.employeeName}
                </Link>
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
              <td className={`${payrollTd('deduction')} payroll-col-screen-only hidden xl:table-cell`}>
                {formatEuroDe(r.advance)}
              </td>
              <td className={`${payrollTd('total')} text-base font-semibold`}>{formatEuroDe(r.total)}</td>
              <td className="px-4 py-2.5 print:hidden">
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
            <td className="employee-col px-4 py-3 text-sm font-bold text-[var(--text-main)]">Summe</td>
            <td className={`${payrollTd('plan')} py-3 font-semibold`}>{formatHoursDe(totals.scheduleHours)}</td>
            <td className={`${payrollTd('time')} py-3 font-semibold`}>{formatHoursDe(totals.timeTrackingHours)}</td>
            <td className={`${payrollTd('used')} py-3 font-semibold`}>{formatHoursDe(totals.usedHours)}</td>
            <td className={`${payrollTd('diff')} py-3 font-semibold`}>{formatDiffHoursDe(totals.differenceHours)}</td>
            <td className={`${payrollTd('extra')} py-3 font-semibold`}>{formatHoursDe(totals.extraUnplannedHours)}</td>
            <td className={`${payrollTd('vacation')} py-3 font-semibold`}>{formatDaysDe(totals.vacationDays)}</td>
            <td className="px-4 py-3" />
            <td className={`${payrollTd('base')} py-3 font-semibold`}>{formatEuroDe(totals.basePay)}</td>
            <td className={`${payrollTd('supplements')} py-3 font-semibold`}>{formatEuroDe(totals.supplementsTotal)}</td>
            <td className={`${payrollTd('deduction')} payroll-col-screen-only hidden py-3 font-semibold xl:table-cell`}>
              {formatEuroDe(totals.advance)}
            </td>
            <td className={`${payrollTd('total')} py-3 text-base font-bold`}>{formatEuroDe(totals.total)}</td>
            <td className="print:hidden" />
          </tr>
        </tfoot>
      </table>
    </PayrollTableScroll>
  )
}
