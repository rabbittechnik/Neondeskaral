export type StationDocumentApi = {
  id: string
  stationId: string
  globalDocument: boolean
  title: string
  description: string | null
  category: string | null
  documentType: string
  fileName: string
  mimeType: string
  fileSize: number
  isTemplate: boolean
  active: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  linkedEmployeeIds: string[]
  templateKey?: string | null
  versionLabel?: string | null
}

export const DOCUMENT_CATEGORIES = [
  { value: '', label: 'Alle Kategorien' },
  { value: 'Personal', label: 'Personal' },
  { value: 'Schnuppertage / Probearbeit', label: 'Schnuppertage / Probearbeit' },
  { value: 'TÜV / Sicherheit', label: 'TÜV / Sicherheit' },
  { value: 'Unterweisungen', label: 'Unterweisungen' },
  { value: 'Sonstige Dokumente', label: 'Sonstige Dokumente' },
  { value: 'TÜV', label: 'TÜV' },
  { value: 'Unterweisung', label: 'Unterweisung' },
  { value: 'Urlaub / Abwesenheit', label: 'Urlaub / Abwesenheit' },
  { value: 'Krankheit', label: 'Krankheit' },
  { value: 'Reinigung / Checklisten', label: 'Reinigung / Checklisten' },
  { value: 'Station', label: 'Station' },
  { value: 'Verträge', label: 'Verträge' },
  { value: 'Sonstiges', label: 'Sonstiges' },
] as const

export const DOCUMENT_TYPES = [
  { value: 'personal_form', label: 'Personalbogen' },
  { value: 'trial_work_agreement', label: 'Vereinbarung Schnuppertage' },
  { value: 'tuv_checklist_template', label: 'TÜV-Monatscheckliste (Vorlage)' },
  { value: 'tuv_report', label: 'TÜV-Bericht' },
  { value: 'vacation_form', label: 'Urlaubsformular' },
  { value: 'sick_note_form', label: 'Krankmeldung / AU' },
  { value: 'instruction_form', label: 'Unterweisungsbogen' },
  { value: 'youth_protection', label: 'Jugendschutzbelehrung' },
  { value: 'privacy', label: 'Datenschutz' },
  { value: 'cleaning_list', label: 'Reinigungsliste / Checkliste' },
  { value: 'other', label: 'Sonstiges' },
] as const

export function documentTypeLabel(code: string): string {
  return DOCUMENT_TYPES.find((t) => t.value === code)?.label ?? code
}
