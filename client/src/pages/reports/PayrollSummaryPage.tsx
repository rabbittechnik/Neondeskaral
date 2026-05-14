import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../context/auth-context'
import { useStation } from '../../context/station-context'
import { useEmployees } from '../../context/employees-context'
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

type DaySource =
  | 'schedule'
  | 'time_tracking'
  | 'time_tracking_extra'
  | 'schedule_fallback'
  | 'paid_vacation'
  | 'manual_correction'
  | 'none'

type DayHighlight = 'green' | 'yellow' | 'orange' | 'red' | 'neutral'

type DayDetail = {
  date: string
  weekdayDe: string
  scheduleShifts: { id: string; label: string; hours: number }[]
  scheduledHours: number
  timeEntries: { id: string; startAt: string; endAt: string | null; hours: number; open: boolean }[]
  trackedHours: number
  usedHours: number
  differenceHours: number
  source: DaySource
  note: string
  highlight: DayHighlight
  daySupplementsEuro: number
  hasConflict: boolean
}

type ReportRow = {
  employeeId: string
  employeeName: string
  employmentType: string
  hourlyWage: number
  registeredHourlyWage?: number
  minimumWageNote?: string
  scheduleHoursTotal: number
  timeTrackingHoursTotal: number
  usedHoursTotal: number
  differenceHours: number
  extraUnplannedHours: number
  missingTimeEntriesDayCount: number
  unplannedWorkDayCount: number
  vacationDays: number
  paidVacationHours: number
  overtimeHours: number
  basePay: number
  supplementsTotal: number
  mankogeld: number
  vl: number
  cashDifference: number
  bonus: number
  advance: number
  total: number
  messages?: string[]
  details: DayDetail[]
}

type Totals = {
  scheduleHours: number
  timeTrackingHours: number
  usedHours: number
  differenceHours: number
  extraUnplannedHours: number
  missingTimeEntriesDayCount: number
  unplannedWorkDayCount: number
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
  hasOpenRunningTimeEntries: boolean
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

function formatYmdDe(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}.${m}.${y}`
}

function formatRegisteredHourly(r: ReportRow): string {
  if (r.registeredHourlyWage == null) return '—'
  return formatEuroDe(r.registeredHourlyWage)
}

function sourceLabelDe(s: DaySource): string {
  switch (s) {
    case 'schedule':
      return 'Schichtplan'
    case 'time_tracking':
      return 'Zeiterfassung'
    case 'time_tracking_extra':
      return 'Zeiterfassung (ohne Plan)'
    case 'schedule_fallback':
      return 'Schichtplan (Fallback)'
    case 'paid_vacation':
      return 'Bezahlter Urlaub'
    case 'manual_correction':
      return 'Manuell'
    default:
      return '—'
  }
}

function highlightClass(h: DayHighlight): string {
  switch (h) {
    case 'green':
      return 'border-l-4 border-emerald-500/80 bg-emerald-500/10'
    case 'yellow':
      return 'border-l-4 border-amber-500/80 bg-amber-500/10'
    case 'orange':
      return 'border-l-4 border-orange-500/80 bg-orange-500/10'
    case 'red':
      return 'border-l-4 border-rose-500/80 bg-rose-500/10'
    default:
      return 'border-l-4 border-white/10 bg-black/20'
  }
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
  'Schichtplan Std.',
  'Zeiterfassung Std.',
  'Verwendet Std.',
  'Differenz',
  'Zusatz Std.',
  'Ohne Stempel (Tage)',
  'Ohne Plan (Tage)',
  'U-Tage',
  'Eingetr. Stundenlohn',
  'Verwend. Stundenlohn',
  'Mindestlohn / Hinweis',
  'Grundlohn',
  'Zuschläge kum.',
  'Mankogeld',
  'VL',
  'Kassendifferenz',
  'Prämie',
  'Vorschuss',
  'Summe',
] as const

export function PayrollSummaryPage() {
  const { user } = useAuth()
  const { stationId, selectedStation, hasPermission } = useStation()
  const { employees } = useEmployees()
  const employeesList = useMemo(
    () => employees.map((e) => ({ id: e.id, displayName: e.displayName })),
    [employees],
  )

  const canView = hasPermission('payroll.view') || hasPermission('reports.payroll')
  const canExport = hasPermission('reports.export') || hasPermission('payroll.export')

  const defaults = useMemo(() => monthStartToToday(), [])
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('all')
  const [employeeIdFilter, setEmployeeIdFilter] = useState<string>('')
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const q: Record<string, string> = {
      stationId,
      from,
      to,
      employmentType: employmentFilter,
    }
    if (employeeIdFilter.trim()) q.employeeIds = employeeIdFilter.trim()
    const res = await apiGet<ReportPayload>('/reports/payroll-combined', q)
    if (!res.ok) {
      setData(null)
      setError(res.error)
    } else {
      setData(res.data)
      setSelected(new Set())
      setDetailEmployeeId(null)
    }
    setLoading(false)
  }, [stationId, from, to, employmentFilter, employeeIdFilter, canView])

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
        scheduleHours: acc.scheduleHours + r.scheduleHoursTotal,
        timeTrackingHours: acc.timeTrackingHours + r.timeTrackingHoursTotal,
        usedHours: acc.usedHours + r.usedHoursTotal,
        differenceHours: acc.differenceHours + r.differenceHours,
        extraUnplannedHours: acc.extraUnplannedHours + r.extraUnplannedHours,
        missingTimeEntriesDayCount: acc.missingTimeEntriesDayCount + r.missingTimeEntriesDayCount,
        unplannedWorkDayCount: acc.unplannedWorkDayCount + r.unplannedWorkDayCount,
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
        scheduleHours: 0,
        timeTrackingHours: 0,
        usedHours: 0,
        differenceHours: 0,
        extraUnplannedHours: 0,
        missingTimeEntriesDayCount: 0,
        unplannedWorkDayCount: 0,
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
      r.scheduleHoursTotal,
      r.timeTrackingHoursTotal,
      r.usedHoursTotal,
      r.differenceHours,
      r.extraUnplannedHours,
      r.missingTimeEntriesDayCount,
      r.unplannedWorkDayCount,
      r.vacationDays,
      r.registeredHourlyWage ?? '',
      r.hourlyWage,
      r.minimumWageNote ?? '',
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
          sum.scheduleHours,
          sum.timeTrackingHours,
          sum.usedHours,
          sum.differenceHours,
          sum.extraUnplannedHours,
          sum.missingTimeEntriesDayCount,
          sum.unplannedWorkDayCount,
          sum.vacationDays,
          '',
          '',
          '',
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

  const exportCsv = (includeDetails: boolean) => {
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
    if (includeDetails && rowsForExport.length) {
      lines.push('')
      lines.push(esc('Tagesdetails'))
      for (const r of rowsForExport) {
        lines.push(esc(`--- ${r.employeeName} ---`))
        const dh = [
          'Datum',
          'Wochentag',
          'Plan Std.',
          'Erfasst Std.',
          'Verwendet',
          'Differenz',
          'Quelle',
          'Hinweis',
          'Zuschlag €',
        ]
        lines.push(dh.map(esc).join(';'))
        for (const d of r.details) {
          lines.push(
            [
              formatYmdDe(d.date),
              d.weekdayDe,
              d.scheduledHours,
              d.trackedHours,
              d.usedHours,
              d.differenceHours,
              sourceLabelDe(d.source),
              d.note,
              d.daySupplementsEuro,
            ]
              .map(esc)
              .join(';'),
          )
        }
      }
    }
    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lohn-zusammenfassung_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportXlsx = () => {
    const { head, body, foot } = buildSheetMatrix()
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([head, ...body, ...(foot ? [foot] : [])])
    XLSX.utils.book_append_sheet(wb, ws, 'Übersicht')
    if (rowsForExport.length) {
      const detailRows: (string | number)[][] = [
        ['Mitarbeiter', 'Datum', 'Wochentag', 'Plan Std.', 'Erfasst Std.', 'Verwendet', 'Differenz', 'Quelle', 'Hinweis', 'Zuschlag €'],
      ]
      for (const r of rowsForExport) {
        for (const d of r.details) {
          detailRows.push([
            r.employeeName,
            formatYmdDe(d.date),
            d.weekdayDe,
            d.scheduledHours,
            d.trackedHours,
            d.usedHours,
            d.differenceHours,
            sourceLabelDe(d.source),
            d.note,
            d.daySupplementsEuro,
          ])
        }
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), 'Tagesdetails')
    }
    XLSX.writeFile(wb, `lohn-zusammenfassung_${from}_${to}.xlsx`)
  }

  const detailRow = useMemo(() => data?.rows.find((r) => r.employeeId === detailEmployeeId) ?? null, [data, detailEmployeeId])

  const toggleDayExpand = (key: string) => {
    setExpandedDays((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  if (!stationId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Lohnabrechnung Zusammenfassung</h1>
        <p className="text-sm text-[var(--text-muted)]">Bitte zuerst eine Station auswählen.</p>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Lohnabrechnung Zusammenfassung</h1>
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
        title="Lohnabrechnung Zusammenfassung"
        description="Schichtplan und freigegebene Zeiterfassung pro Tag abgeglichen: kein automatisches Minus bei fehlender Stempelung, Zuschläge je verwendeter Datenquelle."
      />

      <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100/95">
        Pro Kalendertag (Europe/Berlin) wird max(Schichtplan, Zeiterfassung) verwendet. Kürzere Stempelungen ersetzen den
        Plan nicht; längere Zeiten und Arbeit ohne Plan werden übernommen. Offene Zeiterfassungen (ohne Ende) werden rot
        markiert.
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
          {employeesList.length ? (
            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
              <span>Mitarbeiter</span>
              <select
                value={employeeIdFilter}
                onChange={(e) => setEmployeeIdFilter(e.target.value)}
                className="min-w-[14rem] rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
              >
                <option value="">Alle Mitarbeitenden</option>
                {employeesList.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
            <span>Bis (einschließlich)</span>
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
        <Button type="button" variant="outline" onClick={() => exportCsv(false)} disabled={!canExport || !rowsForExport.length}>
          CSV (Übersicht)
        </Button>
        <Button type="button" variant="outline" onClick={() => exportCsv(true)} disabled={!canExport || !rowsForExport.length}>
          CSV + Tagesdetails
        </Button>
        {!canExport ? (
          <span className="text-xs text-[var(--text-faint)]">Export: reports.export oder payroll.export</span>
        ) : null}
      </div>

      {data?.hasPendingApprovedTime ? (
        <p className="text-sm text-amber-200/90">
          Es gibt noch nicht freigegebene Zeiteinträge im Zeitraum – die Zusammenfassung nutzt nur freigegebene Zeiten.
        </p>
      ) : null}
      {data?.hasOpenRunningTimeEntries ? (
        <p className="text-sm text-rose-300">
          Mindestens eine laufende Zeiterfassung ohne Ende im Zeitraum – bitte prüfen (rote Markierung in der Tagesdetailansicht).
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="min-w-0 overflow-hidden print:shadow-none print:ring-0">
        <div id="payroll-summary-report-print" className="w-full min-w-0 p-2 sm:p-3 lg:p-4 print:p-2">
          <p className="mb-3 text-xs text-[var(--text-muted)] print:hidden">{metaLine}</p>
          <div className="mb-4 hidden print:block">
            <h2 className="text-lg font-semibold text-black">Lohnabrechnung Zusammenfassung</h2>
            <p className="text-sm text-black">{metaLine}</p>
            <p className="text-xs text-neutral-700">
              Erstellt: {new Date().toLocaleString('de-DE')}
              {user?.displayName ? ` · ${user.displayName}` : ''}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Lade Daten…</p>
          ) : !data?.rows.length ? (
            <p className="text-sm text-[var(--text-muted)]">Keine Abrechnungsdaten im gewählten Zeitraum.</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-left text-[10px] leading-snug sm:text-[11px] md:text-xs lg:text-sm print:text-[10px] print:text-black">
              <colgroup>
                {Array.from({ length: 18 }).map((_, i) => (
                  <col key={i} style={{ width: `${100 / 18}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 print:border-neutral-400">
                  <th className="py-1.5 pr-1 print:hidden sm:pr-2">
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
                      className="hyphens-auto break-words px-0.5 py-1.5 pr-1 font-semibold text-[var(--text-main)] sm:px-1 sm:pr-2 print:text-black"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.employeeId} className="border-b border-white/[0.06] print:border-neutral-300">
                    <td className="py-1 pr-1 print:hidden sm:pr-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.employeeId)}
                        onChange={() => toggleRow(r.employeeId)}
                        aria-label={`Auswahl ${r.employeeName}`}
                      />
                    </td>
                    <td className="py-1 pr-1 align-top font-medium text-[var(--text-main)] print:text-black sm:pr-2">
                      <button
                        type="button"
                        className="text-left text-cyan-200/95 underline-offset-2 hover:underline print:text-black"
                        onClick={() => setDetailEmployeeId((cur) => (cur === r.employeeId ? null : r.employeeId))}
                      >
                        {r.employeeName}
                      </button>
                      {r.messages?.length ? (
                        <div className="mt-0.5 text-[9px] font-normal leading-snug text-amber-200/90 print:text-neutral-700 sm:text-[10px]">
                          {r.messages.join(' · ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatHoursDe(r.scheduleHoursTotal)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatHoursDe(r.timeTrackingHoursTotal)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums font-medium sm:pr-2">{formatHoursDe(r.usedHoursTotal)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">
                      {r.differenceHours > 0 ? '+' : ''}
                      {formatHoursDe(r.differenceHours)}
                    </td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatHoursDe(r.extraUnplannedHours)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{r.missingTimeEntriesDayCount}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{r.unplannedWorkDayCount}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatDaysDe(r.vacationDays)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums text-[var(--text-muted)] sm:pr-2">{formatRegisteredHourly(r)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.hourlyWage)}</td>
                    <td className="px-0.5 py-1 pr-1 text-[var(--text-muted)] print:text-[9px] sm:pr-2">
                      {r.minimumWageNote?.trim() ? r.minimumWageNote.trim() : '—'}
                    </td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.basePay)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.supplementsTotal)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.mankogeld)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.vl)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.cashDifference)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.bonus)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums sm:pr-2">{formatEuroDe(r.advance)}</td>
                    <td className="px-0.5 py-1 pr-1 tabular-nums font-semibold text-cyan-200/95 print:text-black sm:pr-2">
                      {formatEuroDe(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/20 font-semibold print:border-neutral-500">
                  <td className="py-2 print:hidden" />
                  <td className="py-2 pr-3 text-[var(--text-main)] print:text-black">Summe</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatHoursDe(data.totals.scheduleHours)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatHoursDe(data.totals.timeTrackingHours)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatHoursDe(data.totals.usedHours)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">
                    {data.totals.differenceHours > 0 ? '+' : ''}
                    {formatHoursDe(data.totals.differenceHours)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatHoursDe(data.totals.extraUnplannedHours)}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{data.totals.missingTimeEntriesDayCount}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{data.totals.unplannedWorkDayCount}</td>
                  <td className="py-2 pr-3 tabular-nums print:text-black">{formatDaysDe(data.totals.vacationDays)}</td>
                  <td className="py-2 pr-3 print:text-black" />
                  <td className="py-2 pr-3 print:text-black" />
                  <td className="py-2 pr-3 print:text-black" />
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

      {detailRow ? (
        <Card className="p-4 print:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[var(--text-main)]">
              Tagesdetails · {detailRow.employeeName}
            </h3>
            <Button type="button" variant="ghost" onClick={() => setDetailEmployeeId(null)}>
              Schließen
            </Button>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Manuelle Korrekturen pro Tag können später ergänzt werden. Farben: grün = Zeiterfassung übernommen / passt,
            gelb = Schichtplan-Fallback, orange = ohne Plan gearbeitet, rot = offene Zeiterfassung.
          </p>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto">
            {detailRow.details.map((d) => {
              const dk = `${detailRow.employeeId}:${d.date}`
              const open = expandedDays.has(dk)
              return (
                <div key={dk} className={`rounded-lg pl-2 ${highlightClass(d.highlight)}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 py-2 pr-2 text-left text-sm text-[var(--text-main)]"
                    onClick={() => toggleDayExpand(dk)}
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="font-medium">
                      {formatYmdDe(d.date)} · {d.weekdayDe}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Plan {formatHoursDe(d.scheduledHours)} · erfasst {formatHoursDe(d.trackedHours)} → verwendet{' '}
                      <span className="text-[var(--text-main)]">{formatHoursDe(d.usedHours)}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-[var(--text-muted)]">{sourceLabelDe(d.source)}</span>
                  </button>
                  {d.note ? <p className="px-8 pb-1 text-xs text-[var(--text-muted)]">{d.note}</p> : null}
                  {open ? (
                    <div className="space-y-2 px-8 pb-3 text-xs">
                      {d.scheduleShifts.length ? (
                        <div>
                          <div className="font-medium text-[var(--text-muted)]">Schichtplan</div>
                          <ul className="list-inside list-disc">
                            {d.scheduleShifts.map((s) => (
                              <li key={`${s.id}-${s.label}`}>
                                {s.label} · {formatHoursDe(s.hours)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-[var(--text-faint)]">Keine Schicht geplant.</div>
                      )}
                      <div>
                        <div className="font-medium text-[var(--text-muted)]">Zeiterfassung</div>
                        {d.timeEntries.length ? (
                          <ul className="space-y-1">
                            {d.timeEntries.map((te) => (
                              <li key={`${te.id}-${te.startAt}-${te.open ? 'o' : 'c'}`}>
                                {te.open ? (
                                  <span className="text-rose-300">Laufend · Start {te.startAt}</span>
                                ) : (
                                  <>
                                    {te.startAt} – {te.endAt} · {formatHoursDe(te.hours)}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-[var(--text-faint)]">Keine erfasste Zeit.</span>
                        )}
                      </div>
                      <div className="tabular-nums text-[var(--text-muted)]">
                        Zuschlag (Tag): {formatEuroDe(d.daySupplementsEuro)} · Differenz verwendet vs. Plan:{' '}
                        {d.differenceHours > 0 ? '+' : ''}
                        {formatHoursDe(d.differenceHours)}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
