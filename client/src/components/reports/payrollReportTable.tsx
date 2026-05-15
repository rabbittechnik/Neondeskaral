import type { ReactNode } from 'react'

/** Scroll-Container für breite Lohnabrechnungstabellen (wie Abwesenheiten). */
export function PayrollTableScroll({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`payroll-table-scroll ${className}`.trim()}>{children}</div>
}

export const PAYROLL_TABLE = 'payroll-report-table border-collapse text-sm'
export const PAYROLL_TABLE_MAIN = 'payroll-report-table payroll-report-table--main border-collapse text-sm'
export const PAYROLL_TABLE_SUMMARY = 'payroll-report-table payroll-report-table--summary border-collapse text-sm'

/** @deprecated Alias */
export const PAYROLL_TABLE_LEGACY = PAYROLL_TABLE_MAIN

export const PAYROLL_TH = 'px-4 py-3 text-xs font-medium uppercase tracking-wide whitespace-nowrap'
export const PAYROLL_TH_NUM = `${PAYROLL_TH} text-right`
export const PAYROLL_TD = 'px-4 py-2.5 align-middle whitespace-nowrap tabular-nums tracking-tight'
export const PAYROLL_TD_NUM = `${PAYROLL_TD} text-right`
export const PAYROLL_TD_EMPLOYEE = `${PAYROLL_TD} employee-col text-left font-medium text-cyan-300`
export const PAYROLL_ROW = 'border-b border-[var(--border-subtle)]/80 hover:bg-white/[0.02]'
export const PAYROLL_TFOOT = 'border-t-2 border-cyan-500/25 bg-[var(--bg-elevated)]/40'
export const PAYROLL_THEAD_ROW = 'border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 text-left'

export const PAYROLL_MIN_W = {
  checkbox: 40,
  employee: 170,
  hours: 110,
  diff: 100,
  vacationDays: 90,
  wage: 110,
  base: 120,
  supplements: 120,
  deduction: 110,
  total: 130,
  details: 100,
  employment: 120,
  vacationHours: 110,
} as const

export const PAYROLL_COL = {
  employee: 'text-cyan-200/90',
  plan: 'text-sky-200/90',
  time: 'text-violet-200/90',
  used: 'text-emerald-200/90',
  diff: 'text-amber-200/90',
  extra: 'text-orange-200/90',
  vacation: 'text-teal-200/90',
  wage: 'text-sky-200/90',
  base: 'text-slate-100/90',
  supplements: 'text-emerald-300/90',
  deduction: 'text-orange-200/80',
  total: 'text-cyan-100',
  muted: 'text-slate-300/90',
  warning: 'text-amber-200/90',
} as const

export function payrollTh(group: keyof typeof PAYROLL_COL, align: 'left' | 'right' = 'right') {
  return `${align === 'right' ? PAYROLL_TH_NUM : PAYROLL_TH} ${PAYROLL_COL[group]}`
}

export function payrollTd(group: keyof typeof PAYROLL_COL, extra = '') {
  return `${PAYROLL_TD_NUM} ${PAYROLL_COL[group]} ${extra}`.trim()
}

export function formatEuroDe(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export function formatHoursDe(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} Std.`
}

export function formatDaysDe(n: number): string {
  return `${n.toFixed(1).replace('.', ',')} Tage`
}

export function formatDiffHoursDe(n: number): string {
  return `${n > 0 ? '+' : ''}${formatHoursDe(n)}`
}

export function formatHoursOrDash(n: number | undefined | null): string {
  if (n == null || n <= 0) return '—'
  return formatHoursDe(n)
}
