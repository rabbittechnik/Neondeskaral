export type TuvTemplateItem = { sortOrder: number; category: string; question: string }

export const TUV_REPORT_TEMPLATE_ITEMS: TuvTemplateItem[] = [
  { sortOrder: 1, category: 'Zapfanlage', question: 'Zapfsäulen äußerlich in Ordnung' },
  { sortOrder: 2, category: 'Zapfanlage', question: 'Zapfpistolen ohne sichtbare Beschädigung' },
  { sortOrder: 3, category: 'Zapfanlage', question: 'Zapfschläuche ohne Risse / Beschädigung' },
  { sortOrder: 4, category: 'Sicherheit', question: 'Not-Aus-Schalter frei zugänglich und gekennzeichnet' },
  { sortOrder: 5, category: 'Sicherheit', question: 'Feuerlöscher vorhanden und Prüfplakette gültig' },
  { sortOrder: 6, category: 'Umwelt / Betrieb', question: 'Ölbindemittel / Bindemittel vorhanden' },
  { sortOrder: 7, category: 'Flächen', question: 'Abfüllflächen sauber und ohne Kraftstoff-/Ölspuren' },
  { sortOrder: 8, category: 'Umwelt', question: 'Entwässerungsrinnen und Abläufe frei' },
  { sortOrder: 9, category: 'Umwelt', question: 'Abscheider / Kontrollschacht äußerlich unauffällig' },
  { sortOrder: 10, category: 'Lager / Schächte', question: 'Domschächte / Füllschächte sauber und trocken' },
  { sortOrder: 11, category: 'Technik', question: 'Peil-/Messsystem ohne Störung' },
  { sortOrder: 12, category: 'Beschilderung', question: 'Preisanzeige / Beleuchtung / Beschilderung in Ordnung' },
  { sortOrder: 13, category: 'Außenbereich', question: 'Außenbereich / Verkehrsflächen sicher und sauber' },
  { sortOrder: 14, category: 'Wasch', question: 'Waschhalle / Waschanlage äußerlich in Ordnung' },
  { sortOrder: 15, category: 'Technik', question: 'Technikraum / Kompressorbereich äußerlich in Ordnung' },
  { sortOrder: 16, category: 'Gefahrstoffe', question: 'Gefahrstoff-/Betriebsstofflager ordentlich' },
  { sortOrder: 17, category: 'Abschluss', question: 'Mängel dokumentiert' },
  { sortOrder: 18, category: 'Abschluss', question: 'Maßnahmen eingeleitet' },
  { sortOrder: 19, category: 'Abschluss', question: 'Besondere Vorkommnisse notiert' },
  { sortOrder: 20, category: 'Abschluss', question: 'Bericht vollständig geprüft' },
]
