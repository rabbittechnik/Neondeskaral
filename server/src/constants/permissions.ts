/** Flache Permission-Keys (Variante A: gleiche Rechte für alle zugewiesenen Stationen). */
export const PERMISSION_KEYS = [
  'dashboard.view',
  'schedule.view',
  'schedule.edit',
  'schedule.create',
  'schedule.delete',
  'schedule.publish',
  'employees.view',
  'employees.create',
  'employees.edit',
  'employees.deactivate',
  'employees.qr',
  'employees.viewSensitive',
  'payroll.view',
  'employees.manageSensitive',
  'absences.view',
  'absences.create',
  'absences.approve',
  'absences.reject',
  'tasks.view',
  'tasks.create',
  'tasks.edit',
  'tasks.control',
  'time.view',
  'time.approve',
  'time.correct',
  'time.checklists',
  'reports.view',
  'reports.payroll',
  'reports.export',
  'settings.view',
  'settings.edit',
  'access.manage',
  'tuvReports.view',
  'tuvReports.create',
  'tuvReports.edit',
  'tuvReports.complete',
  'tuvReports.sign',
  'tuvReports.print',
  'tuvReports.manage',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const FULL_STATION_PERMISSIONS: Record<string, boolean> = Object.fromEntries(
  PERMISSION_KEYS.map((k) => [k, true]),
)

/** Teamleiter-Starter (ohne globale Benutzerverwaltung). */
export const TEAMLEAD_PERMISSIONS: Record<string, boolean> = {
  ...FULL_STATION_PERMISSIONS,
  'access.manage': false,
  'employees.viewSensitive': false,
  'payroll.view': false,
  'employees.manageSensitive': false,
}
