/** Einheitliche Schlüssel + Anzeige für Schichtende-Checklisten.
 *
 * Diese Arrays sind die **eingebauten Standard-Vorlagen** (Seed für `station_shift_close_checklist_defs`).
 * Produktiv werden die sichtbaren Punkte je Station aus der Datenbank geladen; Anpassung pro Station
 * (Reihenfolge, Pflicht Ja/Nein, Gruppe, aktiv) ist für Einstellungen/Stationsverwaltung vorgesehen.
 */

export type ShiftCloseChecklistKind = 'handover' | 'closing'

export type ChecklistGroupId = 'ware' | 'kaffee' | 'reinigung' | 'sicherheit'

export type CatalogItemDef = {
  key: string
  label: string
  /** Nur Ladenschluss; Gruppierung / Wizard-Schritte */
  group?: ChecklistGroupId
}

/** Übergabe ca. 14:00 – 10 Pflichtpunkte (Ja/Nein, bei Nein Begründung). */
export const SHIFT_HANDOVER_CATALOG: CatalogItemDef[] = [
  { key: 'ho_cigarettes_refilled', label: 'Zigaretten aufgefüllt' },
  { key: 'ho_tobacco_tins_papes_eshisha', label: 'Tabak / Dosen / Papes / E-Shisha aufgefüllt bzw. vorgezogen' },
  { key: 'ho_fridges_filled', label: 'Kühlschränke aufgefüllt und vorgezogen' },
  { key: 'ho_register_front_tidy', label: 'Kassenfront ordentlich gerichtet' },
  { key: 'ho_trash_inside_outside', label: 'Mülleimer innen und außen geleert' },
  { key: 'ho_deposit_area', label: 'Pfand weggeräumt / Pfandsack oder Rollcontainer kontrolliert' },
  { key: 'ho_coffee_area', label: 'Kaffeemaschine / Kaffeebereich sauber und aufgefüllt' },
  { key: 'ho_backshop_oven', label: 'Backshop / Ofenbereich kontrolliert' },
  { key: 'ho_sales_floor_clean', label: 'Ladenfläche grob sauber / keine offensichtlichen Verschmutzungen' },
  { key: 'ho_handover_possible', label: 'Übergabe an nächste Schicht möglich' },
]

/** Ladenschluss – 35 Punkte (Ja / Nein / Nicht relevant; bei Nein Begründung). */
export const SHIFT_CLOSING_CATALOG: CatalogItemDef[] = [
  { key: 'cl_cigarettes_refill', label: 'Zigaretten auffüllen', group: 'ware' },
  { key: 'cl_tobacco_30g_tins', label: 'Tabak 30g und Dosen vorziehen / auffüllen', group: 'ware' },
  { key: 'cl_fridges_fill', label: 'Kühlschränke genau auffüllen', group: 'ware' },
  { key: 'cl_register_front', label: 'Kassenfront richten', group: 'ware' },
  { key: 'cl_papes_refill', label: 'Papes auffüllen', group: 'ware' },
  { key: 'cl_eshisha_papes_layout', label: 'E-Shisha / Papes richten', group: 'ware' },
  { key: 'cl_deposit_bag', label: 'Pfand in Pfandsack', group: 'ware' },
  { key: 'cl_deposit_crates_roller', label: 'Pfandkisten auf Rollcontainer', group: 'ware' },
  { key: 'cl_rollis', label: 'Rollis zusammenstellen', group: 'ware' },
  { key: 'cl_storage_cartons', label: 'Lager von Kartons entfernen', group: 'ware' },
  { key: 'cl_storage_tidy', label: 'Lager zusammenstellen', group: 'ware' },
  { key: 'cl_coffee_machine_clean', label: 'Kaffeemaschine putzen', group: 'kaffee' },
  { key: 'cl_coffee_machine_refill', label: 'Kaffeemaschine auffüllen', group: 'kaffee' },
  { key: 'cl_coffee_corner', label: 'Kaffee-Ecke auffüllen', group: 'kaffee' },
  { key: 'cl_coffee_cabinet', label: 'Kaffeeschrank auffüllen', group: 'kaffee' },
  { key: 'cl_backshop_clean', label: 'Backshop putzen', group: 'kaffee' },
  { key: 'cl_oven_clean', label: 'Ofen putzen', group: 'kaffee' },
  { key: 'cl_surfaces_glass_cleaner', label: 'Oberflächen mit Glasreiniger wischen', group: 'reinigung' },
  { key: 'cl_trash_all', label: 'Alle Mülleimer leeren innen und außen', group: 'reinigung' },
  { key: 'cl_floor_vacuum_mop', label: 'Laden saugen / wischen', group: 'reinigung' },
  { key: 'cl_buckets_fresh_water', label: 'Eimer / Kannen mit Frischwasser füllen', group: 'reinigung' },
  { key: 'cl_toilet_clean', label: 'Toilette wischen und sauber machen', group: 'reinigung' },
  { key: 'cl_soap_paper_towels', label: 'Seifenspender / Papier / Trockentücher auffüllen', group: 'reinigung' },
  { key: 'cl_pull_forward_all', label: 'Alles vorziehen', group: 'reinigung' },
  { key: 'cl_register_front_check', label: 'Kassenfront kontrollieren', group: 'reinigung' },
  { key: 'cl_chips_alcohol_sweets', label: 'Chips / Alkohol / Süßwaren auffüllen bzw. kontrollieren', group: 'reinigung' },
  { key: 'cl_boxes_refill', label: 'Boxen auffüllen und vorziehen', group: 'reinigung' },
  { key: 'cl_fridges_check', label: 'Kühlschränke kontrollieren', group: 'reinigung' },
  { key: 'cl_all_doors_locked', label: 'Alle Türen abgeschlossen', group: 'sicherheit' },
  { key: 'cl_entrance_side_doors', label: 'Eingangstür / Nebentüren kontrolliert', group: 'sicherheit' },
  { key: 'cl_storage_side_rooms', label: 'Lager / Nebenräume kontrolliert', group: 'sicherheit' },
  { key: 'cl_lights_off', label: 'Licht komplett aus, soweit vorgesehen', group: 'sicherheit' },
  { key: 'cl_equipment_oven_machines', label: 'Geräte / Ofen / relevante Maschinen kontrolliert', group: 'sicherheit' },
  { key: 'cl_outdoor_area', label: 'Außenbereich kontrolliert', group: 'sicherheit' },
  { key: 'cl_station_closed_properly', label: 'Tankstelle ordnungsgemäß abgeschlossen', group: 'sicherheit' },
]

export const SHIFT_CLOSING_GROUP_LABELS: Record<ChecklistGroupId, string> = {
  ware: 'Ware / Shop',
  kaffee: 'Kaffee / Backshop',
  reinigung: 'Reinigung',
  sicherheit: 'Sicherheit / Ladenschluss',
}

export function catalogForKind(kind: ShiftCloseChecklistKind): CatalogItemDef[] {
  return kind === 'handover' ? SHIFT_HANDOVER_CATALOG : SHIFT_CLOSING_CATALOG
}

export function catalogKeys(kind: ShiftCloseChecklistKind): Set<string> {
  return new Set(catalogForKind(kind).map((i) => i.key))
}
