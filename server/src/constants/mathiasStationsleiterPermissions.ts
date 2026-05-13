import { PERMISSION_KEYS } from './permissions.js'

/**
 * Stationsleiter Aral Bodelshausen — explizite Rechte laut Vorgabe (kein Global-Admin, keine Fremdstationen).
 */
export function mathiasStationsleiterPermissions(): Record<string, boolean> {
  const p = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as Record<string, boolean>
  const on: (typeof PERMISSION_KEYS)[number][] = [
    'dashboard.view',
    'schedule.view',
    'schedule.edit',
    'schedule.create',
    'employees.view',
    'employees.edit',
    'absences.view',
    'absences.create',
    'absences.approve',
    'tasks.view',
    'tasks.edit',
    'time.view',
    'time.approve',
    'payroll.view',
    'reports.view',
    'reports.payroll',
    'tuvReports.view',
    'tuvReports.create',
    'tuvReports.edit',
    'employees.viewAppAccess',
    'stationTablets.view',
    'stationTablets.manage',
    'settings.view',
    'settings.edit',
    'station.profile.edit',
  ]
  for (const k of on) {
    p[k] = true
  }
  return p
}
