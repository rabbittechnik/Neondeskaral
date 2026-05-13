import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useStation } from '../../context/station-context'
import { apiGet } from '../../services/api'

type Cohort = 'active' | 'exited_year'

type SummaryRow = {
  employeeId: string
  employeeName: string
  annualVacationDays: number
  paidVacationTakenDays: number
  remainingVacationDays: number
  unpaidVacationDays: number
  sickDays: number
  specialLeaveDays: number
  paidVacationHoursInYear: number
  active: boolean
  vacationNotMaintained: boolean
}

type SummaryPayload = {
  year: number
  stationId: string
  cohort: Cohort
  rows: SummaryRow[]
  totals: {
    annualVacationDays: number
    paidVacationTakenDays: number
    remainingVacationDays: number
    unpaidVacationDays: number
    sickDays: number
    specialLeaveDays: number
    paidVacationHoursInYear: number
  }
}

function formatDaysDe(n: number): string {
  return `${n.toFixed(1).replace('.', ',')} Tage`
}

function formatHoursDe(n: number): string {
  return `${n.toFixed(1).replace('.', ',')} Std.`
}

function buildYearOptions(): number[] {
  const y = new Date().getFullYear()
  const set = new Set([2024, 2025, 2026, 2027, y - 2, y - 1, y, y + 1, y + 2])
  return Array.from(set).filter((x) => x >= 2000 && x <= 2100).sort((a, b) => a - b)
}

export function AbsenceReportsPage() {
  const { stationId, selectedStation, hasPermission } = useStation()
  const canView =
    hasPermission('reports.view') || hasPermission('absences.view') || hasPermission('payroll.view')

  const yearOptions = useMemo(() => buildYearOptions(), [])
  const defaultYear = new Date().getFullYear()
  const [year, setYear] = useState(defaultYear)
  const [cohort, setCohort] = useState<Cohort>('active')
  const [data, setData] = useState<SummaryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) return
    setLoading(true)
    setError(null)
    const res = await apiGet<SummaryPayload>('/reports/absences-summary', {
      stationId,
      year: String(year),
      cohort,
    })
    if (!res.ok) {
      setData(null)
      setError(res.error)
    } else {
      setData(res.data)
    }
    setLoading(false)
  }, [stationId, year, cohort, canView])

  useEffect(() => {
    void load()
  }, [load])

  if (!stationId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Abwesenheiten</h1>
        <p className="text-sm text-[var(--text-muted)]">Bitte zuerst eine Station auswählen.</p>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-xl font-semibold text-[var(--text-main)]">Abwesenheiten</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Für diese Auswertung fehlt die Berechtigung (reports.view, absences.view oder payroll.view).
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10 print:pb-0">
      <PageHeader
        title="Abwesenheiten"
        description={`Jahresübersicht Urlaub und Krankheit · ${selectedStation?.name ?? 'Station'}`}
      />

      <div className="flex flex-col gap-4 print:hidden lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span>Jahr</span>
            <select
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-0.5">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                cohort === 'active' ? 'bg-lime-500/20 text-lime-100' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              onClick={() => setCohort('active')}
            >
              Aktive Mitarbeiter
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                cohort === 'exited_year' ? 'bg-lime-500/20 text-lime-100' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              onClick={() => setCohort('exited_year')}
            >
              Ausgeschieden im Jahr
            </button>
          </div>
          <Button type="button" variant="outline" className="gap-2 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Drucken
          </Button>
          <Button type="button" variant="ghost" className="gap-2 text-xs text-[var(--text-faint)]" disabled title="Demnächst">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Excel
          </Button>
          <Button type="button" variant="ghost" className="gap-2 text-xs text-[var(--text-faint)]" disabled title="Demnächst">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            PDF
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Abwesenheitsauswertung konnte nicht geladen werden.
          <span className="mt-1 block text-xs text-rose-200/90">{error}</span>
        </div>
      ) : null}

      <Card padding="none" className="overflow-hidden border-cyan-500/15 print:border-white/20">
        {loading ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Lade Auswertung…</p>
        ) : !data ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Keine Daten.</p>
        ) : data.rows.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Keine Mitarbeiter für dieses Jahr gefunden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-medium">Mitarbeiter</th>
                  <th className="px-4 py-3 text-right font-medium text-cyan-200/90">Urlaub {year}</th>
                  <th className="px-4 py-3 text-right font-medium text-sky-300/90">Bez. Urlaub gen.</th>
                  <th className="px-4 py-3 text-right font-medium text-emerald-300/90">Resturlaub</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-300/90">Unbez. Urlaub</th>
                  <th className="px-4 py-3 text-right font-medium text-violet-300/90">Sonderurlaub</th>
                  <th className="px-4 py-3 text-right font-medium text-lime-300/90">Urlaubs-Std.</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-300/90">Krank {year}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const neg = r.remainingVacationDays < 0
                  return (
                    <tr key={r.employeeId} className="border-b border-[var(--border-subtle)]/80 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/employees/${encodeURIComponent(r.employeeId)}`}
                            className="font-medium text-cyan-300 hover:underline"
                          >
                            {r.employeeName}
                          </Link>
                          {r.vacationNotMaintained ? (
                            <span title="Urlaubsanspruch nicht gepflegt" className="inline-flex text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" aria-label="Urlaubsanspruch nicht gepflegt" />
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-cyan-100/90">{formatDaysDe(r.annualVacationDays)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sky-200/90">{formatDaysDe(r.paidVacationTakenDays)}</td>
                      <td
                        className={`px-4 py-2.5 text-right text-base font-semibold tabular-nums ${
                          neg ? 'text-red-400' : 'text-emerald-200'
                        }`}
                        title={
                          neg ? 'Mehr bezahlter Urlaub genommen als Anspruch vorhanden' : undefined
                        }
                      >
                        {formatDaysDe(r.remainingVacationDays)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-200/90">{formatDaysDe(r.unpaidVacationDays)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-violet-200/90">{formatDaysDe(r.specialLeaveDays)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-lime-200/90">{formatHoursDe(r.paidVacationHoursInYear)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-orange-200/90">{formatDaysDe(r.sickDays)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-cyan-500/25 bg-[var(--bg-elevated)]/40">
                  <td className="px-4 py-3 font-semibold text-[var(--text-main)]">Summe</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-cyan-100">
                    {formatDaysDe(data.totals.annualVacationDays)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-sky-200">
                    {formatDaysDe(data.totals.paidVacationTakenDays)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-base font-bold tabular-nums ${
                      data.totals.remainingVacationDays < 0 ? 'text-red-400' : 'text-emerald-200'
                    }`}
                  >
                    {formatDaysDe(data.totals.remainingVacationDays)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-200">
                    {formatDaysDe(data.totals.unpaidVacationDays)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-violet-200">
                    {formatDaysDe(data.totals.specialLeaveDays)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-lime-200">
                    {formatHoursDe(data.totals.paidVacationHoursInYear)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-orange-200">
                    {formatDaysDe(data.totals.sickDays)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-[var(--text-faint)] print:hidden">
        Genommener bezahlter Urlaub: genehmigt, zählt gegen Anspruch. Unbezahlter Urlaub und Sonderurlaub separat. Krank: genehmigt/erfasst.
        Bezahlte Urlaubsstunden: anteilig nach Tagen im Jahr. Berechnung: Kalendertage (Arbeitstage vorbereitet).
      </p>
    </div>
  )
}
