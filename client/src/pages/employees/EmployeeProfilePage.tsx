import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { Employee } from '../../types/employee'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { useEmployees } from '../../context/employees-context'
import { useStation } from '../../context/station-context'
import { mergeEmployeeFromApi } from '../../components/employees/employeeDefaults'
import { apiGet } from '../../services/api'
import { WORK_AREA_DEFINITIONS } from '../../data/mockEmployees'
import { EmployeeStatusBadge } from '../../components/employees/EmployeeStatusBadge'
import { EmploymentTypeBadge } from '../../components/employees/EmploymentTypeBadge'
import { formatDateDe, formatEuroDe, formatHoursDe } from '../../components/employees/employeeFormat'
import { EMPLOYMENT_LABELS, STATUS_LABELS } from '../../components/employees/employeeLabels'
import { EmployeePlanningPreferencesSection } from '../../components/employees/planning/EmployeePlanningPreferencesSection'
import { inputClass } from '../../components/schedule/shift/fieldStyles'

import { EmployeeAppQrSection } from '../../components/employees/EmployeeAppQrSection'

function EmployeeProfileCashCardSection({ employee, readOnly }: { employee: Employee; readOnly: boolean }) {
  const { hasPermission } = useStation()
  const { updateEmployee } = useEmployees()
  const canEditCard = hasPermission('employees.edit') && !readOnly
  const [value, setValue] = useState(employee.cashRegisterCardNumber ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setValue(employee.cashRegisterCardNumber ?? '')
    setMsg(null)
  }, [employee.id, employee.cashRegisterCardNumber])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await updateEmployee({ ...employee, cashRegisterCardNumber: value.trim() })
      setMsg('Gespeichert.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const display = (employee.cashRegisterCardNumber ?? '').trim() || '—'

  return (
    <div className="mt-3 border-t border-[var(--border-subtle)] pt-3 space-y-2">
      {!canEditCard ? (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-[var(--text-faint)]">Kassenkartennummer</span>
          <span className="tabular-nums text-[var(--text-main)]">{display}</span>
        </div>
      ) : (
        <>
          <label htmlFor={`emp-cash-card-${employee.id}`} className="block text-xs font-medium text-[var(--text-faint)]">
            Kassenkartennummer
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <input
              id={`emp-cash-card-${employee.id}`}
              type="text"
              inputMode="numeric"
              className={`${inputClass} max-w-[14rem]`}
              disabled={saving}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
            />
            <Button type="button" variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
          {msg ? <p className="text-xs text-[var(--text-muted)]">{msg}</p> : null}
        </>
      )}
    </div>
  )
}

function EmployeeProfilePlanningSection({ employee }: { employee: Employee }) {
  const { updateEmployee } = useEmployees()
  const [form, setForm] = useState(employee)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setForm(employee)
    setMsg(null)
  }, [employee])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await updateEmployee({ ...employee, ...form })
      setMsg('Gespeichert.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="md" className="border-[var(--border-subtle)]">
      <EmployeePlanningPreferencesSection value={form} onChange={setForm} disabled={saving} />
      {msg ? <p className="mt-3 text-xs text-[var(--text-muted)]">{msg}</p> : null}
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Speichern…' : 'Schichtwünsche speichern'}
        </Button>
      </div>
    </Card>
  )
}

const TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'planning', label: 'Schichtwünsche' },
  { id: 'employeeApp', label: 'Mitarbeiter-App / QR-Code' },
  { id: 'shifts', label: 'Schichten' },
  { id: 'absences', label: 'Abwesenheiten' },
  { id: 'tasks', label: 'Aufgaben' },
  { id: 'times', label: 'Arbeitszeiten' },
  { id: 'pay', label: 'Lohn' },
  { id: 'docs', label: 'Dokumente' },
  { id: 'settings', label: 'Einstellungen' },
] as const

type TabId = (typeof TABS)[number]['id']

export function EmployeeProfilePage() {
  const { employeeId } = useParams()
  const location = useLocation()
  const { employees, restoreEmployee } = useEmployees()
  const { hasPermission } = useStation()
  const canEdit = hasPermission('employees.edit')
  const canSensitive =
    hasPermission('employees.viewSensitive') ||
    hasPermission('payroll.view') ||
    hasPermission('employees.manageSensitive')
  const canQr = hasPermission('employees.qr')
  const [tab, setTab] = useState<TabId>('overview')
  const [fetchedEmployee, setFetchedEmployee] = useState<Employee | null>(null)
  const [employeeFetchLoading, setEmployeeFetchLoading] = useState(false)

  useEffect(() => {
    const st = location.state as { initialTab?: TabId } | null
    if (st?.initialTab && TABS.some((t) => t.id === st.initialTab)) setTab(st.initialTab)
  }, [location.state, employeeId])

  const fromList = useMemo(
    () => (employeeId ? employees.find((e) => e.id === employeeId) : undefined),
    [employeeId, employees],
  )

  useEffect(() => {
    if (!employeeId || fromList) {
      setFetchedEmployee(null)
      return
    }
    let cancelled = false
    setEmployeeFetchLoading(true)
    void apiGet<Employee>(`/employees/${encodeURIComponent(employeeId)}`).then((res) => {
      if (cancelled) return
      setEmployeeFetchLoading(false)
      if (res.ok && res.data) {
        setFetchedEmployee(mergeEmployeeFromApi(res.data as Partial<Employee> & { id: string }))
      } else {
        setFetchedEmployee(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [employeeId, fromList])

  const employee = fromList ?? fetchedEmployee ?? undefined

  if (!employeeId) {
    return <Navigate to="/employees" replace />
  }

  if (!employee) {
    if (employeeFetchLoading) {
      return <p className="text-sm text-[var(--text-muted)]">Profil wird geladen…</p>
    }
    return <Navigate to="/employees" replace />
  }

  const isRemoved = employee.status === 'geloescht'

  const areas = employee.workAreaIds
    .map((id) => WORK_AREA_DEFINITIONS.find((w) => w.id === id))
    .filter(Boolean)

  return (
    <div className="space-y-6 pb-10">
      <Link
        to="/employees"
        className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-white/5 hover:text-[var(--text-main)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Zur Übersicht
      </Link>

      <header className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-cyan-500/20 bg-[var(--bg-card)]/80 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm sm:flex-row sm:items-center">
        <div
          className="shrink-0 rounded-full p-[3px]"
          style={{
            background: employee.color,
            boxShadow: `0 0 20px ${employee.color}66`,
          }}
        >
          <Avatar
            name={employee.displayName}
            src={employee.avatar}
            size="lg"
            className="ring-2 ring-[var(--bg-card)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-[var(--text-main)]">
            {employee.displayName}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{employee.role}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <EmploymentTypeBadge type={employee.employmentType} />
            <EmployeeStatusBadge variant="hr" status={employee.status} />
          </div>
        </div>
      </header>

      {isRemoved ? (
        <div className="rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-[var(--text-muted)]">
          <p>
            Dieser Mitarbeiter wurde aus der aktiven Verwaltung entfernt. Bearbeiten ist erst nach Wiederherstellung
            möglich. Der Mitarbeiter-App-Zugang bleibt aus Sicherheitsgründen deaktiviert, bis er in den
            Einstellungen erneut freigegeben wird.
          </p>
          {canEdit ? (
            <div className="mt-3">
              <Button type="button" variant="primary" onClick={() => void restoreEmployee(employee.id)}>
                Wiederherstellen
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.2)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]/40 text-[var(--text-muted)] hover:border-cyan-400/25'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="md" className="border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Stammdaten</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Name</dt>
                <dd className="text-[var(--text-main)]">
                  {employee.firstName} {employee.lastName}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Geburtstag</dt>
                <dd className="text-[var(--text-main)]">{formatDateDe(employee.birthday)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Eintritt</dt>
                <dd className="text-[var(--text-main)]">{formatDateDe(employee.startDate)}</dd>
              </div>
              {employee.endDate ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-faint)]">Austritt</dt>
                  <dd className="text-[var(--text-main)]">{formatDateDe(employee.endDate)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Beschäftigungsart</dt>
                <dd className="text-[var(--text-main)]">
                  {EMPLOYMENT_LABELS[employee.employmentType]}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Status</dt>
                <dd className="text-[var(--text-main)]">{STATUS_LABELS[employee.status]}</dd>
              </div>
            </dl>
            <EmployeeProfileCashCardSection employee={employee} readOnly={isRemoved} />
          </Card>

          <Card padding="md" className="border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Kontakt</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">E-Mail</dt>
                <dd className="truncate text-cyan-200/90">{employee.email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Telefon</dt>
                <dd className="text-[var(--text-main)]">{employee.phone || '—'}</dd>
              </div>
            </dl>
          </Card>

          <Card padding="md" className="border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Arbeitsbereiche</h2>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {areas.map((w) => (
                <li
                  key={w!.id}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium"
                  style={{
                    borderColor: `${w!.color}55`,
                    boxShadow: `0 0 10px ${w!.color}22`,
                  }}
                >
                  {w!.name}
                </li>
              ))}
            </ul>
          </Card>

          <Card padding="md" className="border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Stunden & Urlaub</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Wochenstunden (Soll)</dt>
                <dd className="tabular-nums text-[var(--text-main)]">
                  {formatHoursDe(employee.weeklyHours)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Monatsstunden (Anzeige)</dt>
                <dd className="tabular-nums text-[var(--text-main)]">
                  {formatHoursDe(employee.monthlyHours)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Stundenlohn</dt>
                <dd className="tabular-nums">
                  {canSensitive && employee.hourlyWage != null ? formatEuroDe(employee.hourlyWage) : '—'}
                </dd>
              </div>
              {canSensitive && employee.monthlySalary != null ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-faint)]">Monatsgehalt</dt>
                  <dd className="tabular-nums">{formatEuroDe(employee.monthlySalary)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-faint)]">Resturlaub</dt>
                <dd className="tabular-nums text-[var(--text-main)]">
                  {employee.remainingVacationDays} Tage
                </dd>
              </div>
            </dl>
          </Card>

          <Card padding="md" className="border-[var(--border-subtle)] lg:col-span-2">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Notizen</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-muted)]">
              {employee.notes || 'Keine Notizen.'}
            </p>
          </Card>
        </div>
      ) : tab === 'planning' ? (
        isRemoved ? (
          <Card padding="md" className="border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">
              Schichtwünsche können für gelöschte Mitarbeitende nicht bearbeitet werden. Bitte zuerst
              wiederherstellen.
            </p>
          </Card>
        ) : (
          <EmployeeProfilePlanningSection employee={employee} />
        )
      ) : tab === 'employeeApp' ? (
        isRemoved ? (
          <Card padding="md" className="border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">
              Der Mitarbeiter-App-Zugang ist deaktiviert. Nach einer Wiederherstellung kann der QR-Zugang unter
              Mitarbeiter-App / QR-Code manuell erneut freigegeben werden.
            </p>
          </Card>
        ) : canQr ? (
          <EmployeeAppQrSection employee={employee} />
        ) : (
          <Card padding="md" className="border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">
              Sie haben keine Berechtigung, QR-Codes oder den persönlichen Mitarbeiter-App-Zugang zu verwalten
              (Berechtigung „QR-Codes verwalten“).
            </p>
          </Card>
        )
      ) : (
        <Card padding="md" className="border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)]/30">
          <p className="text-sm text-[var(--text-muted)]">
            Bereich „{TABS.find((x) => x.id === tab)?.label}“ wird in einer späteren Phase mit
            Inhalten gefüllt.
          </p>
        </Card>
      )}
    </div>
  )
}
