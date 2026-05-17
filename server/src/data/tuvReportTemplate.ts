/** TÜV Rheinland Monatscheckliste – Prüfpunkte (Struktur wie Originalformular). */
export type TuvTemplateItem = {
  sortOrder: number
  position: string
  category: string
  question: string
  /** Zusatzfeld „überprüft am“ (Anzahl: 1 oder 3) */
  checkedOnFields?: 1 | 3
  /** Freitext statt i.O./n.i.O. (z. B. Seriennummer, Wasserstand) */
  freeTextLabel?: string
}

export const TUV_REPORT_TEMPLATE_ITEMS: TuvTemplateItem[] = [
  { sortOrder: 1, position: '1', category: 'Außenbereich', question: 'Verkehrswege' },
  { sortOrder: 2, position: '2', category: 'Außenbereich', question: 'Gebäude' },
  { sortOrder: 3, position: '3', category: 'Außenbereich', question: 'Flüssigkeitsdichte Fahrbahn', checkedOnFields: 1 },
  { sortOrder: 4, position: '4', category: 'Außenbereich', question: 'Domschächte, Fernfüllschächte' },
  { sortOrder: 5, position: '5', category: 'Außenbereich', question: 'Tankbereich, Zapfsäulen' },
  { sortOrder: 6, position: '6', category: 'Außenbereich', question: 'Feuerlöscher' },
  { sortOrder: 7, position: '7', category: 'Außenbereich', question: 'Altölsammelbehälter' },
  { sortOrder: 8, position: '8', category: 'Außenbereich', question: 'Reifenfüllmesser' },
  { sortOrder: 9, position: '9', category: 'Außenbereich', question: 'Abfallsammelplatz' },
  { sortOrder: 10, position: '10', category: 'Außenbereich', question: 'Fahrzeugwaschanlage' },
  { sortOrder: 11, position: '11', category: 'Außenbereich', question: 'Hochdruckreiniger' },
  { sortOrder: 12, position: '12', category: 'Außenbereich', question: 'Abscheideranlagen', checkedOnFields: 3 },
  { sortOrder: 13, position: '13', category: 'Außenbereich', question: 'SB-Sauger' },
  { sortOrder: 14, position: '13b', category: 'Außenbereich', question: 'E-Mobility Bauteile' },
  { sortOrder: 15, position: '13c', category: 'Außenbereich', question: 'Ausschilderung Videoanlage an den Grundstückszufahrten bzw. -zugängen' },
  { sortOrder: 16, position: '14', category: 'Innenbereich', question: 'Alarmplan' },
  { sortOrder: 17, position: '15', category: 'Innenbereich', question: 'Fenster, Türen, Tore' },
  { sortOrder: 18, position: '16', category: 'Innenbereich', question: 'Leckanzeigegeräte' },
  { sortOrder: 19, position: '17', category: 'Innenbereich', question: 'Gasrückführung, KKS-Anlage, Gaswarngerät' },
  { sortOrder: 20, position: '18', category: 'Innenbereich', question: 'Wasserpeilung Kraftstofftanks', freeTextLabel: 'Wasserstand' },
  { sortOrder: 21, position: '19', category: 'Innenbereich', question: 'Überwachung Videoanlage' },
  { sortOrder: 22, position: '20', category: 'Innenbereich', question: 'Notausschalter' },
  { sortOrder: 23, position: '21', category: 'Innenbereich', question: 'Geldbewegungen' },
  { sortOrder: 24, position: '22', category: 'Innenbereich', question: 'Regale' },
  { sortOrder: 25, position: '23', category: 'Innenbereich', question: 'Leitern, Tritte' },
  { sortOrder: 26, position: '24', category: 'Innenbereich', question: 'Fußboden' },
  { sortOrder: 27, position: '25', category: 'Innenbereich', question: 'Notausgänge' },
  { sortOrder: 28, position: '26', category: 'Innenbereich', question: 'Persönliche Schutzausrüstung' },
  { sortOrder: 29, position: '27', category: 'Innenbereich', question: 'Gefahrstoffe' },
  { sortOrder: 30, position: '28', category: 'Innenbereich', question: 'Ölbindemittel' },
  { sortOrder: 31, position: '29', category: 'Innenbereich', question: 'Streugut' },
  { sortOrder: 32, position: '30', category: 'Innenbereich', question: 'Druckluftanlagen' },
  { sortOrder: 33, position: '31', category: 'Innenbereich', question: 'Hebebühne, Auswuchtmaschine, Reifenmontiergerät' },
  { sortOrder: 34, position: '32', category: 'Innenbereich', question: 'Kartenterminal', freeTextLabel: 'Seriennummer' },
  { sortOrder: 35, position: '32a', category: 'Innenbereich', question: 'Kartenterminal Zusatzzeile a', freeTextLabel: 'Eintrag' },
  { sortOrder: 36, position: '32b', category: 'Innenbereich', question: 'Kartenterminal Zusatzzeile b', freeTextLabel: 'Eintrag' },
  { sortOrder: 37, position: '32c', category: 'Innenbereich', question: 'Kartenterminal Zusatzzeile c', freeTextLabel: 'Eintrag' },
  { sortOrder: 38, position: '32d', category: 'Innenbereich', question: 'Kartenterminal Zusatzzeile d', freeTextLabel: 'Eintrag' },
  { sortOrder: 39, position: '32e', category: 'Innenbereich', question: 'Kartenterminal Zusatzzeile e', freeTextLabel: 'Eintrag' },
  { sortOrder: 40, position: '33', category: 'Innenbereich', question: 'Rauchmelder monatliche Funktionskontrolle' },
  { sortOrder: 41, position: '34', category: 'Innenbereich', question: 'Hygienechecks gemäß HQM-Vorgaben durchgeführt' },
  { sortOrder: 42, position: '35', category: 'Organisation / jährliche Prüfintervalle', question: 'HSSE-Unterlagen' },
  { sortOrder: 43, position: '36', category: 'Organisation / jährliche Prüfintervalle', question: 'Prüffristen' },
  { sortOrder: 44, position: '37', category: 'Organisation / jährliche Prüfintervalle', question: 'Mitarbeiterunterweisung' },
  { sortOrder: 45, position: '38', category: 'Organisation / jährliche Prüfintervalle', question: 'Sammelpunkt' },
  { sortOrder: 46, position: '39', category: 'Organisation / jährliche Prüfintervalle', question: 'Brandschutz' },
  { sortOrder: 47, position: '40', category: 'Organisation / jährliche Prüfintervalle', question: 'Erste Hilfe' },
  { sortOrder: 48, position: '41', category: 'Organisation / jährliche Prüfintervalle', question: 'Lüftung, Klima, Heizung' },
  { sortOrder: 49, position: '42', category: 'Organisation / jährliche Prüfintervalle', question: 'Erdgastankstellen der Fa. MoviaTec' },
  { sortOrder: 50, position: '43', category: 'Organisation / jährliche Prüfintervalle', question: 'Notausschalter, Probeauslösung' },
]

/** Anzeige in der UI: Positionsnummer + Frage */
export function formatTuvItemLabel(item: TuvTemplateItem): string {
  return `${item.position}. ${item.question}`
}
