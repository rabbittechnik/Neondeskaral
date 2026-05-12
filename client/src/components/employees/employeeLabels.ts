import type { EmployeeHRStatus, EmploymentType } from '../../types/employee'

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  vollzeit: 'Vollzeit',
  teilzeit: 'Teilzeit',
  minijob: 'Minijob',
  aushilfe: 'Aushilfe',
  schueler: 'Schüler',
  werkstudent: 'Werkstudent',
  sonstige: 'Sonstige',
}

export const STATUS_LABELS: Record<EmployeeHRStatus, string> = {
  aktiv: 'Aktiv',
  inaktiv: 'Inaktiv',
  urlaub: 'Urlaub',
  krank: 'Krank',
  gesperrt: 'Gesperrt',
  geloescht: 'Archiviert',
}
