import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../context/auth-context'
import { useStation } from '../../context/station-context'
import { apiGet } from '../../services/api'

type EmploymentFilter =
  | 'all'
  | 'all_with_exited'
  | 'vollzeit'
  | 'teilzeit'
  | 'aushilfe'
  | 'schichtleiter'
  | 'chef'
  | 'exited'

type ReportRow = {
  employeeId: string
  employeeName: string
  employmentType: string
  hourlyWage: number
  totalHours: number
  overtimeHours: number
  vacationDays: number
  paidVacationHours: number
  basePay: number
  supplementsTotal: number
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance: number
  total: number
  messages?: string[]
}

type Totals = {
  totalHours: number
  overtimeHours: number
  vacationDays: number
  basePay: number
  supplementsTotal: number
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance: number
  total: number
}

type ReportPayload = {
  stationId: string
  stationName: string
  fromDate: string
  toDate: string
  hasPendingApprovedTime: boolean
  reportSource?: 'time_tracking' | 'schedule_plan'
  rows: ReportRow[]
  totals: Totals
}

function monthStartToToday(): { from: string; to: string } {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` }
}

function formatEuroDe(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatHoursDe(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} Std.`
}

function formatDaysDe(n: number): string {
  return `${n.toFixed(1).replace('.', ',')} Tage`
}

const FILTER_OPTIONS: { value: EmploymentFilter; label: string }[] = [
  { value: 'all', label: 'Alle Beschäftigungsarten' },
  { value: 'vollzeit', label: 'Vollzeit' },
  { value: 'teilzeit', label: 'Teilzeit' },
  { value: 'aushilfe', label: 'Aushilfe' },
  { value: 'schichtleiter', label: 'Schichtleiter' },
  { value: 'chef', label: 'Chef / Administrator' },
  { value: 'exited', label: 'Ausgeschiedene' },
  { value: 'all_with_exited', label: 'Alle inkl. ausgeschiedene (aktiv)' },
]

const COL_HEADERS = [
  'Mitarbeiter',
  'Stundenlohn',
  'Stunden Gesamt',
  'Überstd.',
  'U-Tage',
  'Lohn/Gehalt / Monat',
  'Zuschläge kumuliert',
  'Mankogeld / Monat',
  'VL / Monat',
  'Kassendifferenz',
  'Prämie',
  'Vorschuß',
  'Summe',
] as const

export function PayrollSchedulePage() {
  const { user } = useAuth()
  const { stationId, selectedStation, hasPermission } = useStation()
  const canView = hasPermission('payroll.view') || hasPermission('reports.payroll')
  const canExport = hasPermission('reports.export') || hasPermission('payroll.export')

  const defaults = useMemo(() => monthStartToToday(), [])
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('all')
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const res = await apiGet<ReportPayload>('/reports/payroll-schedule', {
      stationId,
      from,
      to,
      employmentType: employmentFilter,
    })
    if (!res.ok) {
      setData(null)
      setError(res.error)
    } else {
      setData(res.data)
      setSelected(new Set())
    }
    setLoading(false)
  }, [stationId, from, to, employmentFilter, canView])

  useEffect(() => {
    void load()
  }, [load])

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleAll = () => {
    if (!data?.rows.length) return
    if (selected.size === data.rows.length) setSelected(new Set())
    else setSelected(new Set(data.rows.map((r) => r.employeeId)))
  }

  const rowsForExport = useMemo(() => {
    if (!data?.rows.length) return []
    if (selected.size === 0) return data.rows
    return data.rows.filter((r) => selected.has(r.employeeId))
  }, [data, selected])

  const exportTotals = useMemo(() => {
    if (!rowsForExport.length) return null
    const t = rowsForExport.reduce(
      (acc, r) => ({
        totalHours: acc.totalHours + r.totalHours,
        overtimeHours: acc.overtimeHours + r.overtimeHours,
        vacationDays: acc.vacationDays + r.vacationDays,
        basePay: acc.basePay + r.basePay,
        supplementsTotal: acc.supplementsTotal + r.supplementsTotal,
        mankogeld: acc.mankogeld + r.mankogeld,
        vl: acc.vl + r.vl,
        cashDifference: acc.cashDifference + r.cashDifference,
        bonus: acc.bonus + r.bonus,
        advance: acc.advance + r.advance,
        total: acc.total + r.total,
      }),
      {
        totalHours: 0,
        overtimeHours: 0,
        vacationDays: 0,
        basePay: 0,
        supplementsTotal: 0,
        mankogeld: 0,
        vl: 0,
        cashDifference: 0,
        bonus: 0,
        advance: 0,
        total: 0,
      },
    )
    const keys = Object.keys(t) as (keyof typeof t)[]
    return keys.reduce(
      (acc, k) => {
        acc[k] = Math.round(t[k] * 100) / 100
        return acc
      },
      { ...t },
    )
  }, [rowsForExport])

  const buildSheetMatrix = useCallback(() => {
    const head = ['', ...COL_HEADERS]
    const body = rowsForExport.map((r) => [
      '',
      r.employeeName,
      r.hourlyWage,
      r.totalHours,
      r.overtimeHours,
      r.vacationDays,
      r.basePay,
      r.supplementsTotal,
      r.mankogeld,
      r.vl,
      r.cashDifference,
      r.bonus,
      r.advance,
      r.total,
    ])
    const sum = exportTotals
    const foot = sum
      ? [
          '',
          'Summe',
          '',
          sum.totalHours,
          sum.overtimeHours,
          sum.vacationDays,
          sum.basePay,
          sum.supplementsTotal,
          sum.mankogeld,
          sum.vl,
          sum.cashDifference,
          sum.bonus,
          sum.advance,
          sum.total,
        ]
      : null
    return { head, body, foot }
  }, [rowsForExport, exportTotals])

  const exportCsv = () => {
    const { head, body, foot } = buildSheetMatrix()
    const esc = (v: string | number) => {
      const s = String(v).replace(/"/g, '""')
      return `"${s}"`
    }
    const lines = [
      head.map(esc).join(';'),
      ...body.map((row) => row.map(esc).join(';')),
      ...(foot ? [foot.map(esc).join(';')] : []),
    ]
    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lohn-schichtplan_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportXlsx = () => {
    const { head, body, foot } = buildSheetMatrix()
    const ws = XLSX.utils.aoa_to_sheet([head, ...body, ...(foot ? [foot] : [])])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lohn')
    XLSX.writeFile(wb, `lohn-schichtplan_${from}_${to}.xlsx`)
  }

  if (!stationId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Lohnabrechnung (Schichtplan)</h1>
        <p className="text-sm text-[var(--text-muted)]">Bitte zuerst eine Station auswählen.</p>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Lohnabrechnung (Schichtplan)</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Keine Berechtigung. Erforderlich: <span className="text-cyan-200/90">payroll.view</span> oder{' '}
          <span className="text-cyan-200/90">reports.payroll</span>.
        </p>
      </div>
    )
  }

  const metaLine = `${selectedStation?.name ?? data?.stationName ?? 'Station'} · ${from} – ${to}`

  return (
    <div className="space-y-6 pb-10 print:pb-0">
      <PageHeader
        title="Lohnabrechnung (Schichtplan)"
        description="Auswertung auf Basis geplanter Schichten, Urlaub und Profil-/Anpassungswerte · gleicher Server-Endpunkt wie Exporte"
      />

      <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100/95">
        Arbeitsstunden werden aus dem Schichtplan (Start, Ende, Pause) berechnet – nicht aus der Zeiterfassung.
      </p>

      <div className="flex flex-col gap-4 print:hidden xl:flex-row xl:flex-wrap xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            <span>Filter: Beschäftigungsart</span>
            <select
              value={employmentFilter}
              onChange={(e) => setEmploymentFilter(e.target.value as EmploymentFilter)}
              className="min-w-[14rem] rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
            >
              {FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            Aktualisieren
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            <span>Von</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            <span>Bis</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => window.print()}
          disabled={!data?.rows.length}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Druck (PDF)
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={exportXlsx}
          disabled={!canExport || !rowsForExport.length}
          title={!canExport ? 'reports.export oder payroll.export erforderlich' : undefined}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Excel (XLSX)
        </Button>
        <Button type="button" variant="outline" onClick={exportCsv} disabled={!canExport || !rowsForExport.length}>
          CSV
        </Button>
        {!canExport ? (
          <span className="text-xs text-[var(--text-faint)]">Export: reports.export oder payroll.export</span>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="overflow-x-auto print:shadow-none print:ring-0">
        <div id="payroll-schedule-report-print" className="min-w-[1100px] p-4 print:min-w-0 print:p-2">
          <p className="mb-3 text-xs text-[var(--text-muted)] print:hidden">{metaLine}</p>
          <div className="mb-4 hidden print:block">
            <h2 className="text-lg font-semibold text-black">Lohnabrechnung (Schichtplan)</h2>
            <p className="text-sm text-black">{metaLine}</p>
            <p className="text-xs text-neutral-700">
              Erstellt: {new Date().toLocaleString('de-DE')}
              {user?.displayName ? ` · ${user.displayName}` : ''}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Lade Daten…</p>
          ) : !data?.rows.length ? (
            <p className="text-sm text-[var(--text-muted)]">
              Keine Abrechnungsdaten im gewählten Zeitraum (keine Schichten oder keine relevanten Buchungen).
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm print:text-black">
              <thead>
                <tr className="border-b border-white/10 print:border-neutral-400">
                  <th className="w-10 py-2 pr-2 print:hidden">
                    <input
                      type="checkbox"
                      aria-label="Alle auswählen"
                      checked={selected.size === data.rows.length && data.rows.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  {COL_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap py-2 pr-3 font-semibold text-[var(--text-main)] print:text-black"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.employeeId} className="border-b border-white/[0.06] print:border-neutral-300">
                    <td className="py-1.5 pr-2 print:hidden">
                      <input
                        type="checkbox"
                        checked={selected.has(r.employeeId)}
                        onChange={() => toggleRow(r.employeeId)}
                        aria-label={`Auswahl ${r.employeeName}`}
                      />
                    </td>
                    <td className="py-1.5 pr-3 align-top font-medium text-[var(--text-main)] print:text-black">
                      <div>{r.employeeName}</div>
                      {r.messages?.length ? (
                        <div className="mt-1 max-w-[14rem] text-[10px] font-normal leading-snug text-amber-200/90 print:text-neutral-700 print:max-w-none">
                          {r.messages.join(' · ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.hourlyWage)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatHoursDe(r.totalHours)}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-[var(--text-faint)]">
                      {r.overtimeHours > 0 ? formatHoursDe(r.overtimeHours) : '—'}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatDaysDe(r.vacationDays)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.basePay)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.supplementsTotal)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.mankogeld)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.vl)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.cashDifference)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.bonus)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{formatEuroDe(r.advance)}</td>
                    <td className="py-1.5 pr-3 tabular-nums font-semibold text-cyan-200/95 print:text-black">
                      {formatEuroDe(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/20 font-semibold print:border-neutral-500">
                  <td className="py-2 print:hidden" />
                  <td className="py-2 pr-3 text-[var(--text-main)] print:text-black">Summe</td>
                  <td className="py-2 pr-3 print:text-black" />
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatHoursDe(data.totals.totalHours)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">
                    {data.totals.overtimeHours > 0 ? formatHoursDe(data.totals.overtimeHours) : '—'}
                  </td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatDaysDe(data.totals.vacationDays)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatEuroDe(data.totals.basePay)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatEuroDe(data.totals.supplementsTotal)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatEuroDe(data.totals.mankogeld)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatEuroDe(data.totals.vl)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatEuroDe(data.totals.cashDifference)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatEuroDe(data.totals.bonus)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatEuroDe(data.totals.advance)}</td>
                  <td className="py-2 pr-3 tabular-nums text-cyan-200 print:text-black">{formatEuroDe(data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
