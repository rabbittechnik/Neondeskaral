import { useMemo, useState } from 'react'
import type { Employee, EmploymentType, Salutation } from '../../types/employee'
import { useStation } from '../../context/station-context'
import { useEmployees } from '../../context/employees-context'
import { useWorkAreas } from '../../context/work-areas-context'
import { inputClass, labelClass, selectClass } from '../schedule/shift/fieldStyles'
import { ColorPickerField } from './ColorPickerField'
import { STATUS_LABELS, EMPLOYMENT_LABELS } from './employeeLabels'
import { EmployeePlanningPreferencesSection } from './planning/EmployeePlanningPreferencesSection'
import { EmployeeAppQrSection } from './EmployeeAppQrSection'

type Props = {
  value: Employee
  onChange: (next: Employee) => void
  disabled?: boolean
  mode: 'create' | 'edit'
}

const TABS: { id: string; label: string }[] = [
  { id: 'stammdaten', label: 'Stammdaten' },
  { id: 'einstellungen', label: 'Einstellungen' },
  { id: 'arbeitsbereiche', label: 'Arbeitsbereiche' },
  { id: 'beschaeftigung', label: 'Beschäftigung' },
  { id: 'entgelt', label: 'Entgelt' },
  { id: 'urlaub', label: 'Urlaub & Pausen' },
  { id: 'zuschlaege', label: 'Zuschläge' },
  { id: 'ueberstunden', label: 'Überstundenkonto' },
  { id: 'bank', label: 'Bankverbindung' },
  { id: 'datenschutz', label: 'Datenschutz' },
  { id: 'app', label: 'Mitarbeiter-App / QR' },
  { id: 'planung', label: 'Schichtwünsche' },
]

const salutationOptions: { v: Salutation; l: string }[] = [
  { v: 'herr', l: 'Herr' },
  { v: 'frau', l: 'Frau' },
  { v: 'divers', l: 'Divers' },
  { v: 'none', l: 'Keine Angabe' },
]

const employmentOptions: EmploymentType[] = [
  'vollzeit',
  'teilzeit',
  'minijob',
  'aushilfe',
  'schueler',
  'werkstudent',
  'sonstige',
]

const statusOptions = Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]

const timeModeOpts = [
  { v: 'station_default', l: 'Aus Stationseinstellungen übernehmen' },
  { v: 'stamp_auto', l: 'Stempeluhr / automatische Zeitstempel' },
  { v: 'manual', l: 'Manuell' },
  { v: 'none', l: 'Keine Zeiterfassung' },
]

const breakModeOpts = [
  { v: 'station_default', l: 'Aus Stationseinstellungen übernehmen' },
  { v: 'own', l: 'Eigene Pausenregel' },
  { v: 'none', l: 'Keine automatische Pause' },
]

const mobilePunchOpts = [
  { v: 'station_default', l: 'Aus Stationseinstellungen übernehmen' },
  { v: 'allowed', l: 'Erlaubt' },
  { v: 'denied', l: 'Nicht erlaubt' },
]

const checkIoOpts = [
  { v: 'station_default', l: 'Aus Stationseinstellungen übernehmen' },
  { v: 'terminal_only', l: 'Nur am Terminal' },
  { v: 'terminal_and_app', l: 'Terminal und Mitarbeiter-App' },
  { v: 'app_only', l: 'Nur Mitarbeiter-App' },
  { v: 'manual_lead', l: 'Manuell durch Leitung' },
]

const employmentRoles = [
  'Chef',
  'Stationsleitung',
  'Teamleitung',
  'Schichtleitung',
  'Verkäufer',
  'Aushilfe',
  'Büro',
  'Reinigung',
  'Sonstige',
]

const workDayKeys = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const
const workDayLabels: Record<(typeof workDayKeys)[number], string> = {
  mo: 'Mo',
  di: 'Di',
  mi: 'Mi',
  do: 'Do',
  fr: 'Fr',
  sa: 'Sa',
  so: 'So',
}

function chipToggle(
  selected: string[],
  key: string,
  onChange: (next: string[]) => void,
  disabled?: boolean,
) {
  const set = new Set(selected)
  const on = () => {
    if (set.has(key)) set.delete(key)
    else set.add(key)
    onChange(Array.from(set))
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={on}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        set.has(key)
          ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-white/20'
      }`}
    >
      {workDayLabels[key as (typeof workDayKeys)[number]] ?? key}
    </button>
  )
}

export function EmployeeFormTabs({ value, onChange, disabled, mode }: Props) {
  const [tab, setTab] = useState('stammdaten')
  const { hasPermission } = useStation()
  const { employees, getById } = useEmployees()
  const patch = (p: Partial<Employee>) => onChange({ ...value, ...p })

  const canSensitive =
    hasPermission('employees.viewSensitive') ||
    hasPermission('payroll.view') ||
    hasPermission('employees.manageSensitive')

  const canEditEmployees = hasPermission('employees.edit')

  const canQr = hasPermission('employees.qr')

  const ctxEmp = value.id ? getById(value.id) : undefined
  const employeeForQr = useMemo(() => {
    if (!ctxEmp) return value
    return {
      ...value,
      employeeAccessToken: ctxEmp.employeeAccessToken ?? value.employeeAccessToken,
      employeeAccessEnabled: ctxEmp.employeeAccessEnabled ?? value.employeeAccessEnabled,
      employeeAccessConfigured: ctxEmp.employeeAccessConfigured ?? value.employeeAccessConfigured,
      employeeAccessCreatedAt: ctxEmp.employeeAccessCreatedAt ?? value.employeeAccessCreatedAt,
      employeeAccessLastUsedAt: ctxEmp.employeeAccessLastUsedAt ?? value.employeeAccessLastUsedAt,
    }
  }, [value, ctxEmp])

  const toggleWa = (id: string) => {
    const set = new Set(value.workAreaIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    patch({ workAreaIds: Array.from(set) })
  }

  const tabBtn = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      disabled={disabled}
      onClick={() => setTab(id)}
      className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition md:text-sm ${
        tab === id
          ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[var(--glow-cyan)]'
          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )

  const sectionCard = (title: string, hint: string | undefined, children: React.ReactNode) => (
    <div className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
      </div>
      {children}
    </div>
  )

  const overtimeBlock = sectionCard(
        'Überstundenkonto',
        'Änderungen an Arbeitszeit oder Entgelt können die Überstundenlogik beeinflussen (Berechnung folgt später).',
        <>
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.overtimeEnabled}
              onChange={(e) => patch({ overtimeEnabled: e.target.checked })}
            />
            Überstundenkonto aktivieren
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Startwert (Std.)</label>
              <input
                type="number"
                step={0.25}
                className={inputClass}
                disabled={disabled}
                value={value.overtimeStartValue ?? ''}
                onChange={(e) => patch({ overtimeStartValue: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>ab Datum</label>
              <input
                type="date"
                className={inputClass}
                disabled={disabled}
                value={value.overtimeStartDate?.slice(0, 10) ?? ''}
                onChange={(e) => patch({ overtimeStartDate: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>aktueller Stand (optional)</label>
              <input
                type="number"
                step={0.25}
                className={inputClass}
                disabled={disabled}
                value={value.overtimeCurrentValue ?? ''}
                onChange={(e) =>
                  patch({ overtimeCurrentValue: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.overtimeAutoCalculate}
              onChange={(e) => patch({ overtimeAutoCalculate: e.target.checked })}
            />
            Überstunden automatisch berechnen
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.overtimeIncludeInReports}
              onChange={(e) => patch({ overtimeIncludeInReports: e.target.checked })}
            />
            In Auswertungen berücksichtigen
          </label>
        </>,
      )

  return (
    <div className="flex max-h-[min(78vh,820px)] flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-subtle)] pb-2">
        {TABS.map((t) => tabBtn(t.id, t.label))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === 'stammdaten' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Anrede *</label>
              <select
                className={selectClass}
                disabled={disabled}
                value={value.salutation}
                onChange={(e) => patch({ salutation: e.target.value as Salutation })}
              >
                {salutationOptions.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden sm:block" />
            <div>
              <label className={labelClass}>Vorname *</label>
              <input className={inputClass} disabled={disabled} value={value.firstName} onChange={(e) => patch({ firstName: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Nachname *</label>
              <input className={inputClass} disabled={disabled} value={value.lastName} onChange={(e) => patch({ lastName: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Anzeigename</label>
              <input className={inputClass} disabled={disabled} value={value.displayName} onChange={(e) => patch({ displayName: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Kurzname (optional)</label>
              <input className={inputClass} disabled={disabled} value={value.shortName} onChange={(e) => patch({ shortName: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Mobilnummer</label>
              <input className={inputClass} disabled={disabled} value={value.mobilePhone} onChange={(e) => patch({ mobilePhone: e.target.value, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Festnetz</label>
              <input className={inputClass} disabled={disabled} value={value.landlinePhone} onChange={(e) => patch({ landlinePhone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>E-Mail</label>
              <input type="email" className={inputClass} disabled={disabled} value={value.email} onChange={(e) => patch({ email: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Geburtsdatum</label>
              <input type="date" className={inputClass} disabled={disabled} value={value.birthday} onChange={(e) => patch({ birthday: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Personalnummer</label>
              <input className={inputClass} disabled={disabled} value={value.personnelNumber} onChange={(e) => patch({ personnelNumber: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <ColorPickerField
                id="emp-color"
                value={value.color}
                disabled={disabled}
                employees={employees}
                currentEmployeeId={value.id}
                onChange={(c) => patch({ color: c })}
              />
            </div>
          </div>
        ) : null}

        {tab === 'einstellungen' ? (
          <div className="space-y-4">
            {sectionCard(
              'Einstellungen',
              'PIN wird gehasht gespeichert und nicht angezeigt.',
              <>
                {canSensitive ? (
                  <div>
                    <label className={labelClass}>Neue PIN setzen (optional)</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className={inputClass}
                      disabled={disabled}
                      value={value.pin ?? ''}
                      onChange={(e) => patch({ pin: e.target.value })}
                      placeholder="••••"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)]">PIN setzen: keine Berechtigung.</p>
                )}
                <div>
                  <label className={labelClass}>Zeiterfassung *</label>
                  <select
                    className={selectClass}
                    disabled={disabled}
                    value={value.timeTrackingMode}
                    onChange={(e) => patch({ timeTrackingMode: e.target.value })}
                  >
                    {timeModeOpts.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Pausen *</label>
                  <select
                    className={selectClass}
                    disabled={disabled}
                    value={value.breakMode}
                    onChange={(e) => patch({ breakMode: e.target.value })}
                  >
                    {breakModeOpts.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Mobiles Stempeln *</label>
                  <select
                    className={selectClass}
                    disabled={disabled}
                    value={value.mobilePunchMode}
                    onChange={(e) => patch({ mobilePunchMode: e.target.value })}
                  >
                    {mobilePunchOpts.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Einstempeln</label>
                  <select
                    className={selectClass}
                    disabled={disabled}
                    value={value.checkInMode}
                    onChange={(e) => patch({ checkInMode: e.target.value })}
                  >
                    {checkIoOpts.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Ausstempeln</label>
                  <select
                    className={selectClass}
                    disabled={disabled}
                    value={value.checkOutMode}
                    onChange={(e) => patch({ checkOutMode: e.target.value })}
                  >
                    {checkIoOpts.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.l}
                      </option>
                    ))}
                  </select>
                </div>
                {canSensitive || canEditEmployees ? (
                  <div>
                    <label className={labelClass}>Kassenkartennummer</label>
                    <input
                      className={inputClass}
                      disabled={disabled}
                      value={value.cashRegisterCardNumber ?? ''}
                      onChange={(e) => patch({ cashRegisterCardNumber: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      Für das Stations-Tablet; leer lassen, wenn keine Karten-Anmeldung gewünscht ist.
                    </p>
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <input type="checkbox" disabled={disabled} checked={value.terminalEnabled} onChange={(e) => patch({ terminalEnabled: e.target.checked })} />
                  Terminalzugang aktiv
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <input type="checkbox" disabled={disabled} checked={value.employeeAppEnabled} onChange={(e) => patch({ employeeAppEnabled: e.target.checked })} />
                  Mitarbeiter-App aktiv
                </label>
              </>,
            )}
          </div>
        ) : null}

        {tab === 'arbeitsbereiche' ? (
          <WorkAreasTab value={value} disabled={disabled} toggleWa={toggleWa} />
        ) : null}

        {tab === 'beschaeftigung' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Art *</label>
              <select
                className={selectClass}
                disabled={disabled}
                value={value.employmentType}
                onChange={(e) => patch({ employmentType: e.target.value as EmploymentType })}
              >
                {employmentOptions.map((k) => (
                  <option key={k} value={k}>
                    {EMPLOYMENT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={selectClass}
                disabled={disabled}
                value={value.status}
                onChange={(e) => patch({ status: e.target.value as Employee['status'] })}
              >
                {statusOptions.map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Rolle im Betrieb</label>
              <select
                className={selectClass}
                disabled={disabled}
                value={value.employmentRole}
                onChange={(e) => patch({ employmentRole: e.target.value, role: e.target.value })}
              >
                {employmentRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Eintrittsdatum *</label>
              <input type="date" className={inputClass} disabled={disabled} value={value.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Austritt</label>
              <input type="date" className={inputClass} disabled={disabled} value={value.endDate ?? ''} onChange={(e) => patch({ endDate: e.target.value || undefined })} />
            </div>
          </div>
        ) : null}

        {tab === 'entgelt' && canSensitive ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
              ACHTUNG: Änderungen an der Arbeitszeit können Einfluss auf das Überstundenkonto haben. Bitte Stand prüfen.
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="payType" disabled={disabled} checked={value.payType === 'salary'} onChange={() => patch({ payType: 'salary' })} />
                  Gehaltsempfänger
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="payType" disabled={disabled} checked={value.payType !== 'salary'} onChange={() => patch({ payType: 'hourly' })} />
                  Stundenlohnempfänger
                </label>
              </div>
              {value.payType === 'salary' ? (
                <div>
                  <label className={labelClass}>Monatsgehalt (€)</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.monthlySalary ?? ''} onChange={(e) => patch({ monthlySalary: Number(e.target.value) })} />
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Stundenlohn (€)</label>
                  <input type="number" step={0.01} className={inputClass} disabled={disabled} value={value.hourlyWage ?? ''} onChange={(e) => patch({ hourlyWage: Number(e.target.value) })} />
                </div>
              )}
              <div>
                <label className={labelClass}>Max. Std./Monat</label>
                <input type="number" step={0.25} className={inputClass} disabled={disabled} value={value.maxHoursPerMonth ?? ''} onChange={(e) => patch({ maxHoursPerMonth: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2">
                <span className={labelClass}>Arbeitstage</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workDayKeys.map((d) =>
                    chipToggle(value.workDays ?? [], d, (wd) => patch({ workDays: wd }), disabled),
                  )}
                </div>
              </div>
              <div>
                <label className={labelClass}>Mankogeld (€)</label>
                <input type="number" step={0.01} className={inputClass} disabled={disabled} value={value.mankoMoney ?? ''} onChange={(e) => patch({ mankoMoney: Number(e.target.value) })} />
              </div>
              <div>
                <label className={labelClass}>VL (€)</label>
                <input type="number" step={0.01} className={inputClass} disabled={disabled} value={value.vlAmount ?? ''} onChange={(e) => patch({ vlAmount: Number(e.target.value) })} />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <input type="checkbox" disabled={disabled} checked={Boolean(value.hideInPayroll)} onChange={(e) => patch({ hideInPayroll: e.target.checked })} />
                In Lohnabrechnung ausblenden
              </label>
            </div>
          </div>
        ) : tab === 'entgelt' && !canSensitive ? (
          <p className="text-sm text-[var(--text-muted)]">Keine Berechtigung für Entgeltdaten.</p>
        ) : null}

        {tab === 'urlaub' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input type="checkbox" disabled={disabled} checked={value.useStationBreakSettings} onChange={(e) => patch({ useStationBreakSettings: e.target.checked })} />
              Pausenregel aus Stationseinstellungen übernehmen
            </label>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input type="checkbox" disabled={disabled} checked={value.ownBreakRuleEnabled} onChange={(e) => patch({ ownBreakRuleEnabled: e.target.checked })} />
              Eigene Pausenregel aktiv
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input type="checkbox" disabled={disabled} checked={value.vacationStartEnabled} onChange={(e) => patch({ vacationStartEnabled: e.target.checked })} />
              Startwert Urlaub angeben
            </label>
            <div />
            <div>
              <label className={labelClass}>Startwert (Tage)</label>
              <input type="number" step={0.5} className={inputClass} disabled={disabled} value={value.vacationStartValue ?? ''} onChange={(e) => patch({ vacationStartValue: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>ab dem</label>
              <input type="date" className={inputClass} disabled={disabled} value={value.vacationStartDate?.slice(0, 10) ?? ''} onChange={(e) => patch({ vacationStartDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Jahresurlaub (Tage)</label>
              <input type="number" step={0.5} className={inputClass} disabled={disabled} value={value.annualVacationDays ?? ''} onChange={(e) => patch({ annualVacationDays: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>Std. pro Urlaubstag</label>
              <input type="number" step={0.25} className={inputClass} disabled={disabled} value={value.vacationHoursPerDay ?? ''} onChange={(e) => patch({ vacationHoursPerDay: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input type="checkbox" disabled={disabled} checked={value.vacationAutoAverage13Weeks} onChange={(e) => patch({ vacationAutoAverage13Weeks: e.target.checked })} />
              Urlaubsstunden automatisch nach Ø 13 Wochen
            </label>
            <div>
              <label className={labelClass}>1. Pause (Min.)</label>
              <input type="number" step={1} className={inputClass} disabled={disabled} value={value.firstBreakValue ?? ''} onChange={(e) => patch({ firstBreakValue: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>nach (Std.)</label>
              <input type="number" step={0.25} className={inputClass} disabled={disabled} value={value.firstBreakAfterHours ?? ''} onChange={(e) => patch({ firstBreakAfterHours: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>2. Pause (Min.)</label>
              <input type="number" step={1} className={inputClass} disabled={disabled} value={value.secondBreakValue ?? ''} onChange={(e) => patch({ secondBreakValue: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelClass}>nach (Std.)</label>
              <input type="number" step={0.25} className={inputClass} disabled={disabled} value={value.secondBreakAfterHours ?? ''} onChange={(e) => patch({ secondBreakAfterHours: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </div>
          </div>
        ) : null}

        {tab === 'zuschlaege' ? (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Modus</label>
              <select className={selectClass} disabled={disabled} value={value.surchargeMode} onChange={(e) => patch({ surchargeMode: e.target.value })}>
                <option value="none">Keine Zuschläge</option>
                <option value="tax_free">Steuerfreie Zuschläge</option>
                <option value="individual">Individuell</option>
              </select>
            </div>
            {value.surchargeMode === 'individual' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Nachtzuschlag %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.nightSurchargePercent ?? ''} onChange={(e) => patch({ nightSurchargePercent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>Nacht von</label>
                  <input type="time" className={inputClass} disabled={disabled} value={value.nightSurchargeStart} onChange={(e) => patch({ nightSurchargeStart: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Nacht bis</label>
                  <input type="time" className={inputClass} disabled={disabled} value={value.nightSurchargeEnd} onChange={(e) => patch({ nightSurchargeEnd: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] sm:col-span-2">
                  <input type="checkbox" disabled={disabled} checked={value.nightSurchargeAfterTwoHours} onChange={(e) => patch({ nightSurchargeAfterTwoHours: e.target.checked })} />
                  Nachtzuschlag nach mehr als 2 Std. im Zeitraum
                </label>
                <div>
                  <label className={labelClass}>Samstag %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.saturdaySurchargePercent ?? ''} onChange={(e) => patch({ saturdaySurchargePercent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>Sonntag %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.sundaySurchargePercent ?? ''} onChange={(e) => patch({ sundaySurchargePercent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>Feiertag / 31.12. ab 14 Uhr %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.holidaySurchargePercent ?? ''} onChange={(e) => patch({ holidaySurchargePercent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>Besondere Feiertage %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.specialHolidaySurchargePercent ?? ''} onChange={(e) => patch({ specialHolidaySurchargePercent: Number(e.target.value) })} />
                </div>
                <p className="sm:col-span-2 text-xs text-[var(--text-faint)]">Zuschläge 0–4 Uhr (nach Vortag)</p>
                <div>
                  <label className={labelClass}>0–4 Uhr %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.night04SurchargePercent ?? ''} onChange={(e) => patch({ night04SurchargePercent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>nach Sonntag %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.night04AfterSundayPercent ?? ''} onChange={(e) => patch({ night04AfterSundayPercent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>nach Feiertag %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.night04AfterHolidayPercent ?? ''} onChange={(e) => patch({ night04AfterHolidayPercent: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelClass}>nach bes. Feiertag %</label>
                  <input type="number" className={inputClass} disabled={disabled} value={value.night04AfterSpecialHolidayPercent ?? ''} onChange={(e) => patch({ night04AfterSpecialHolidayPercent: Number(e.target.value) })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Berechnung</label>
                  <select className={selectClass} disabled={disabled} value={value.surchargeCalculationMode} onChange={(e) => patch({ surchargeCalculationMode: e.target.value })}>
                    <option value="higher">Immer den höheren Zuschlag zahlen</option>
                    <option value="cumulative">Nacht- und Sonn-/Feiertagszuschläge kumulieren</option>
                  </select>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'ueberstunden' ? overtimeBlock : null}

        {tab === 'bank' && canSensitive ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100/90">
              Bankdaten sind besonders schützenswert und werden in Listen nicht angezeigt.
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>IBAN</label>
              <input className={inputClass} disabled={disabled} value={value.iban ?? ''} onChange={(e) => patch({ iban: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>BIC</label>
              <input className={inputClass} disabled={disabled} value={value.bic ?? ''} onChange={(e) => patch({ bic: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Kontoinhaber</label>
              <input className={inputClass} disabled={disabled} value={value.accountHolder ?? ''} onChange={(e) => patch({ accountHolder: e.target.value })} />
            </div>
          </div>
        ) : tab === 'bank' && !canSensitive ? (
          <p className="text-sm text-[var(--text-muted)]">Keine Berechtigung für Bankdaten.</p>
        ) : null}

        {tab === 'datenschutz' ? (
          <div className="space-y-3 text-sm text-[var(--text-muted)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={disabled} checked={value.hideContactInAddressBook} onChange={(e) => patch({ hideContactInAddressBook: e.target.checked })} />
              Kontakt im Adressbuch verbergen
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={disabled} checked={value.showOnlyFirstNameInEmployeeApp} onChange={(e) => patch({ showOnlyFirstNameInEmployeeApp: e.target.checked })} />
              In öffentlicher Mitarbeiter-App nur Vornamen zeigen
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={disabled} checked={value.visibleInTeamSchedule} onChange={(e) => patch({ visibleInTeamSchedule: e.target.checked })} />
              Im Team-Schichtplan sichtbar
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={disabled} checked={value.phoneVisibleToTeam} onChange={(e) => patch({ phoneVisibleToTeam: e.target.checked })} />
              Telefonnummer für Team sichtbar
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={disabled} checked={value.emailVisibleToTeam} onChange={(e) => patch({ emailVisibleToTeam: e.target.checked })} />
              E-Mail für Team sichtbar
            </label>
          </div>
        ) : null}

        {tab === 'app' ? (
          mode === 'edit' ? (
            canQr ? (
              <EmployeeAppQrSection employee={employeeForQr} />
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Keine Berechtigung für QR-Codes / Mitarbeiter-App-Zugang.
              </p>
            )
          ) : (
            <p className="text-sm text-[var(--text-muted)]">QR-Code und App-Link stehen nach dem Speichern zur Verfügung.</p>
          )
        ) : null}

        {tab === 'planung' ? <EmployeePlanningPreferencesSection value={value} onChange={onChange} disabled={disabled} /> : null}
      </div>
    </div>
  )
}

function WorkAreasTab({
  value,
  disabled,
  toggleWa,
}: {
  value: Employee
  disabled?: boolean
  toggleWa: (id: string) => void
}) {
  const { definitions } = useWorkAreas()
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">Mehrfachauswahl für die aktuelle Station.</p>
      <div className="flex flex-wrap gap-2">
        {definitions.map((w) => (
          <button
            key={w.id}
            type="button"
            disabled={disabled}
            onClick={() => toggleWa(w.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              value.workAreaIds.includes(w.id)
                ? 'border-cyan-400/55 bg-cyan-500/20 text-cyan-50'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-white/15'
            }`}
          >
            {w.name}
          </button>
        ))}
      </div>
    </div>
  )
}
