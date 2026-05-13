/** Labels für Admin-Benutzer (stationbezogene Keys wie in `server/src/constants/permissions.ts`). */

export const ADMIN_PERMISSION_UI: { key: string; label: string }[] = [
  { key: 'dashboard.view', label: 'Dashboard ansehen' },
  { key: 'schedule.view', label: 'Schichtplan ansehen' },
  { key: 'schedule.edit', label: 'Schichtplan bearbeiten' },
  { key: 'schedule.create', label: 'Schichten erstellen' },
  { key: 'schedule.delete', label: 'Schichten löschen' },
  { key: 'employees.view', label: 'Mitarbeiter ansehen' },
  { key: 'employees.create', label: 'Mitarbeiter erstellen' },
  { key: 'employees.edit', label: 'Mitarbeiter bearbeiten' },
  { key: 'employees.deactivate', label: 'Mitarbeiter deaktivieren' },
  { key: 'employees.delete', label: 'Mitarbeiter endgültig löschen (ohne Historie)' },
  { key: 'employees.viewDeleted', label: 'Gelöschte Mitarbeiter in der Liste anzeigen' },
  { key: 'employees.qr', label: 'QR-Codes verwalten' },
  { key: 'employees.viewAppAccess', label: 'Mitarbeiter-App-Zugänge ansehen' },
  { key: 'employees.manageAppAccess', label: 'Mitarbeiter-App-Zugänge verwalten' },
  { key: 'employees.viewDevices', label: 'Geräteübersicht (Mitarbeiter-App)' },
  { key: 'employees.revokeDevices', label: 'Gerätezugänge widerrufen' },
  { key: 'stationTablets.view', label: 'Stations-Tablets ansehen (Terminal-QR)' },
  { key: 'stationTablets.manage', label: 'Stations-Tablets verwalten (anlegen, QR, deaktivieren)' },
  { key: 'employees.viewSensitive', label: 'Sensible Mitarbeiterdaten (PIN/Karte/Entgelt)' },
  { key: 'payroll.view', label: 'Lohn-/Entgeltdaten einsehen' },
  { key: 'employees.manageSensitive', label: 'Sensible Mitarbeiterdaten verwalten' },
  { key: 'absences.view', label: 'Abwesenheiten ansehen' },
  { key: 'absences.create', label: 'Abwesenheiten erstellen' },
  { key: 'absences.approve', label: 'Abwesenheiten genehmigen' },
  { key: 'tasks.view', label: 'Aufgaben ansehen' },
  { key: 'tasks.create', label: 'Aufgaben erstellen' },
  { key: 'tasks.edit', label: 'Aufgaben bearbeiten' },
  { key: 'tasks.control', label: 'Aufgaben kontrollieren' },
  { key: 'time.view', label: 'Zeiterfassung ansehen' },
  { key: 'time.approve', label: 'Zeiten freigeben' },
  { key: 'time.correct', label: 'Zeiten korrigieren' },
  { key: 'reports.view', label: 'Auswertungen (Reports) ansehen' },
  { key: 'settings.view', label: 'Einstellungen ansehen' },
  { key: 'settings.edit', label: 'Einstellungen bearbeiten' },
  { key: 'access.manage', label: 'Benutzer/Zugriffe verwalten' },
  { key: 'tuvReports.view', label: 'TÜV-Berichte ansehen' },
  { key: 'tuvReports.create', label: 'TÜV-Bericht erstellen' },
  { key: 'tuvReports.edit', label: 'TÜV-Bericht bearbeiten' },
  { key: 'tuvReports.complete', label: 'TÜV-Bericht abschließen' },
  { key: 'tuvReports.sign', label: 'TÜV-Bericht unterschreiben/bestätigen' },
  { key: 'tuvReports.print', label: 'TÜV-Bericht drucken' },
  { key: 'tuvReports.manage', label: 'TÜV-Berichte verwalten' },
]

export const ADMIN_FORM_ROLES = [
  { value: 'stationsleiter', label: 'Stationsleiter' },
  { value: 'teamleiter', label: 'Teamleiter' },
  { value: 'buero', label: 'Büro / Lohn' },
  { value: 'admin_station', label: 'Admin für Station' },
] as const

export function emptyAdminPerms(): Record<string, boolean> {
  return Object.fromEntries(ADMIN_PERMISSION_UI.map((p) => [p.key, false]))
}
