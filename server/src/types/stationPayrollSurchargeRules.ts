/**
 * Stationsregeln für Lohn-Zuschläge (zentral, überschreibt Profil-Zeitboni an normalen Werktagen).
 */
export type StationPayrollSurchargeRules = {
  /** Früh-/Nachtzuschlag (z. B. vor 06:00) an Mo–Fr ohne Feiertag. */
  normalWeekdayNightBonusEnabled: boolean
  /** Spätzuschlag (z. B. nach 20:00) an Mo–Fr ohne Feiertag — gleiche Nachtfenster-Logik. */
  normalWeekdayEveningBonusEnabled: boolean
  /** Samstagszuschlag aus Mitarbeiterprofil. */
  saturdaySurchargeEnabled: boolean
  /** Sonntagszuschlag aus Mitarbeiterprofil. */
  sundaySurchargeEnabled: boolean
  /** Zuschläge aus Schichtplan, wenn Planstunden > 0 (statt Stempelzeit). */
  supplementsPreferSchedule: boolean
  /** Fallback % für gesetzliche B-Feiertage, wenn im Profil kein bes.-Feiertag-% gesetzt ist. */
  defaultSpecialHolidayPercent: number
}

export const DEFAULT_STATION_PAYROLL_SURCHARGE_RULES: StationPayrollSurchargeRules = {
  normalWeekdayNightBonusEnabled: true,
  normalWeekdayEveningBonusEnabled: true,
  saturdaySurchargeEnabled: true,
  sundaySurchargeEnabled: true,
  supplementsPreferSchedule: false,
  defaultSpecialHolidayPercent: 150,
}

/** Aral Bodelshausen: nur Feiertagszuschläge (125 % / 150 %), keine Früh-/Spät-/Nachtzuschläge an Werktagen. */
export const ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES: StationPayrollSurchargeRules = {
  normalWeekdayNightBonusEnabled: false,
  normalWeekdayEveningBonusEnabled: false,
  saturdaySurchargeEnabled: false,
  sundaySurchargeEnabled: false,
  supplementsPreferSchedule: true,
  defaultSpecialHolidayPercent: 150,
}
