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
  /**
   * Nur Sonntags- und Feiertagszuschläge (Aral Bodelshausen).
   * Kein Nacht-, Früh-, Spät-, Samstags- oder 0–4-Uhr-Zuschlag — auch nicht aus dem Mitarbeiterprofil.
   */
  onlySundayAndHolidaySupplements: boolean
}

export const DEFAULT_STATION_PAYROLL_SURCHARGE_RULES: StationPayrollSurchargeRules = {
  normalWeekdayNightBonusEnabled: true,
  normalWeekdayEveningBonusEnabled: true,
  saturdaySurchargeEnabled: true,
  sundaySurchargeEnabled: true,
  supplementsPreferSchedule: false,
  defaultSpecialHolidayPercent: 150,
  onlySundayAndHolidaySupplements: false,
}

/** Aral Bodelshausen: nur Sonntags- und Feiertagszuschläge — keine Nacht-/Früh-/Spät-/Samstagszuschläge. */
export const ARAL_BODELSHAUSEN_PAYROLL_SURCHARGE_RULES: StationPayrollSurchargeRules = {
  normalWeekdayNightBonusEnabled: false,
  normalWeekdayEveningBonusEnabled: false,
  saturdaySurchargeEnabled: false,
  sundaySurchargeEnabled: true,
  supplementsPreferSchedule: true,
  defaultSpecialHolidayPercent: 150,
  onlySundayAndHolidaySupplements: true,
}

export function stationSurchargePolicySummaryDe(rules: StationPayrollSurchargeRules): string[] {
  if (rules.onlySundayAndHolidaySupplements) {
    return [
      'Zuschläge nur an Sonntagen und gesetzlichen Feiertagen.',
      'Nachtzuschläge: deaktiviert',
      'Früh-/Spätzuschläge (z. B. ab 20:00 oder vor 06:00): deaktiviert',
      'Samstagszuschläge: deaktiviert',
      'Normale Werktage (Mo–Sa ohne Feiertag): kein Zuschlag — auch bei Start 05:30 oder Ende nach 20:00',
    ]
  }
  const lines: string[] = []
  if (!rules.normalWeekdayNightBonusEnabled && !rules.normalWeekdayEveningBonusEnabled) {
    lines.push('Nacht-/Spätzuschläge an normalen Werktagen: deaktiviert')
  }
  if (!rules.saturdaySurchargeEnabled) lines.push('Samstagszuschläge: deaktiviert')
  if (!rules.sundaySurchargeEnabled) lines.push('Sonntagszuschläge: deaktiviert')
  return lines
}
