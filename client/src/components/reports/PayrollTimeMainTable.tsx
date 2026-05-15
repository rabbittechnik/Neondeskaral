import { Button } from '../ui/Button'
import {
  PayrollTableScroll,
  PAYROLL_TABLE_MAIN,
  PAYROLL_ROW,
  PAYROLL_TFOOT,
  PAYROLL_THEAD_ROW,
  PAYROLL_TD_EMPLOYEE,
  PAYROLL_MIN_W,
  payrollTh,
  payrollTd,
  formatDaysDe,
  formatEuroDe,
  formatHoursDe,
  formatHoursOrDash,
} from './payrollReportTable'

export type PayrollTimeTableRow = {
  employeeId: string
  employeeName: string
  hourlyWage: number
  workPlanHours?: number
  totalHours: number
  vacationDays: number
  paidVacationHours: number
  basePay: number
  supplementsTotal: number
  advance: number
  total: number
  messages?: string[]
}

export type PayrollTimeTableTotals = {
  workPlanHours: number
  totalHours: number
  vacationDays: number
  paidVacationHours: number
  basePay: number
  supplementsTotal: number
  advance: number
  total: number
}

type Props = {
  rows: PayrollTimeTableRow[]
  totals: PayrollTimeTableTotals
  selected: Set<string>
  onToggleRow: (id: string) => void
  onToggleAll: () => void
  onOpenDetails: (employeeId: string) => void
}

const mw = (n: number) => ({ minWidth: n })

export function PayrollTimeMainTable({
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
            <th className={payrollTh('wage')} style={mw(PAYROLL_MIN_W.wage)}>
              Stundenlohn
            </th>
            <th className={payrollTh('time')} style={mw(PAYROLL_MIN_W.hours)}>
              Erfasst
            </th>
            <th className={payrollTh('used')} style={mw(PAYROLL_MIN_W.hours)}>
              Freigegeben
            </th>
            <th
              className={`${payrollTh('warning')} payroll-col-screen-only hidden xl:table-cell`}
              style={mw(PAYROLL_MIN_W.hours)}
            >
              Offen
            </th>
            <th className={payrollTh('vacation')} style={mw(PAYROLL_MIN_W.vacationDays)}>
              U-Tage
            </th>
            <th
              className={`${payrollTh('used')} payroll-col-screen-only hidden lg:table-cell`}
              style={mw(PAYROLL_MIN_W.vacationHours)}
            >
              Urlaub Std.
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
                <span className="text-cyan-300">{r.employeeName}</span>
                {r.messages?.length ? (
                  <div className="mt-1 max-w-[14rem] text-xs font-normal leading-snug text-amber-200/90">
                    {r.messages.join(' · ')}
                  </div>
                ) : null}
              </td>
              <td className={payrollTd('wage')}>{formatEuroDe(r.hourlyWage)}</td>
              <td className={payrollTd('time')}>{formatHoursOrDash(r.workPlanHours)}</td>
              <td className={payrollTd('used')}>
                <span className="font-medium">{formatHoursDe(r.totalHours)}</span>
              </td>
              <td className={`${payrollTd('warning')} payroll-col-screen-only hidden xl:table-cell`} title="Nicht freigegebene Zeiten siehe Details">
                —
              </td>
              <td className={payrollTd('vacation')}>{formatDaysDe(r.vacationDays)}</td>
              <td className={`${payrollTd('used')} payroll-col-screen-only hidden lg:table-cell`}>
                {formatHoursDe(r.paidVacationHours)}
              </td>
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
            <td className="py-3" />
            <td className={`${payrollTd('time')} py-3 font-semibold`}>{formatHoursDe(totals.workPlanHours)}</td>
            <td className={`${payrollTd('used')} py-3 font-semibold`}>{formatHoursDe(totals.totalHours)}</td>
            <td className="payroll-col-screen-only hidden xl:table-cell" />
            <td className={`${payrollTd('vacation')} py-3 font-semibold`}>{formatDaysDe(totals.vacationDays)}</td>
            <td className={`${payrollTd('used')} payroll-col-screen-only hidden py-3 font-semibold lg:table-cell`}>
              {formatHoursDe(totals.paidVacationHours)}
            </td>
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
