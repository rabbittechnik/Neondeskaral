/** Feste Stations-Vorlagen (PDF-Dateien unter server/data/document-templates/). */
export type DocumentTemplateKey = 'schnuppertage' | 'personalbogen_2026' | 'tuv_monatscheckliste'

export type DocumentTemplateDef = {
  key: DocumentTemplateKey
  title: string
  description: string
  category: string
  documentType: string
  version: string
  fileName: string
  /** Datei relativ zu server/data/document-templates/ */
  sourceFile: string
  mimeType: string
}

export const DOCUMENT_TEMPLATE_CATALOG: DocumentTemplateDef[] = [
  {
    key: 'schnuppertage',
    title: 'Vereinbarung Schnuppertage',
    description: 'Vorlage für Schnuppertage bzw. Probearbeit.',
    category: 'Schnuppertage / Probearbeit',
    documentType: 'trial_work_agreement',
    version: '2026',
    fileName: 'Vereinbarung_Schnuppertage.pdf',
    sourceFile: 'vereinbarung-schnuppertage.pdf',
    mimeType: 'application/pdf',
  },
  {
    key: 'personalbogen_2026',
    title: 'Personalbogen Aushilfe / Personalbogen 2026',
    description:
      'Personalbogen für neue Aushilfen und Mitarbeitende (Arbeitgeber, persönliche Daten, Bank, Beschäftigung, Steuer, Sozialversicherung).',
    category: 'Personal',
    documentType: 'personal_form',
    version: '2026',
    fileName: 'Personalbogen_2026.pdf',
    sourceFile: 'personalbogen-2026.pdf',
    mimeType: 'application/pdf',
  },
  {
    key: 'tuv_monatscheckliste',
    title: 'TÜV Rheinland Sicherheits-Checkliste / Monatscheckliste',
    description: 'Monatliche Sicherheits-Checkliste für die Tankstelle. Verknüpft mit dem Modul „Monatlicher TÜV-Bericht“.',
    category: 'TÜV / Sicherheit',
    documentType: 'tuv_checklist_template',
    version: '07/2023',
    fileName: 'TUV_Monatscheckliste.pdf',
    sourceFile: 'tuv-monatscheckliste.pdf',
    mimeType: 'application/pdf',
  },
]

export function getDocumentTemplateByKey(key: string): DocumentTemplateDef | undefined {
  return DOCUMENT_TEMPLATE_CATALOG.find((t) => t.key === key)
}

/** Relativer Ordnername (Legacy); Auflösung erfolgt in stationDocumentService. */
export function documentTemplatesRootDir(): string {
  return 'data/document-templates'
}
