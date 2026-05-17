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
  'employees.delete',
  'employees.viewDeleted',
  'employees.qr',
  'employees.viewAppAccess',
  'employees.manageAppAccess',
  'employees.viewDevices',
  'employees.revokeDevices',
  /** Stations-Tablets: Terminal-QR / Geräte unter „Mein Konto“ */
  'stationTablets.view',
  'stationTablets.manage',
  'employees.viewSensitive',
  'payroll.view',
  'payroll.export',
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
  /** Alle Stationen anlegen/bearbeiten/archivieren (Admin / delegiert). */
  'stations.manage',
  /** Stammdaten der zugewiesenen Station(en) bearbeiten (ohne neue Station anzulegen). */
  'station.profile.edit',
  /** Vertreter / Lieferantenkontakte der Station. */
  'representatives.view',
  'representatives.edit',
  /** Archivieren dauerhaft entfernen (Soft-Delete); Bearbeiten reicht meist für Archiv. */
  'representatives.delete',
  'documents.view',
  'documents.upload',
  'documents.edit',
  'documents.archive',
  'documents.print',
  'documents.create_employee_from_document',
  /** PDF-Lohnabrechnungen im Mitarbeiterprofil (vertraulich). */
  'employeePayrollDocuments.view',
  'employeePayrollDocuments.manage',
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
  'payroll.export': false,
  /** Ohne explizite Lohn-Berechtigung kein Zugriff auf Lohn-Auswertungen (nur payroll.view). */
  'reports.payroll': false,
  'employees.manageSensitive': false,
  'employees.delete': false,
  'employees.viewDeleted': false,
  'stationTablets.view': true,
  'stationTablets.manage': true,
  'stations.manage': false,
  'station.profile.edit': false,
  'representatives.delete': false,
}
