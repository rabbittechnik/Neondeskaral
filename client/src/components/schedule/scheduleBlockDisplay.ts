import type { ShiftTypeId } from '../../data/mockSchedule'

/** Kürzerer Anzeigename bei schmalen Balken: „Max V.“ */
export function shortenPersonNameForShiftBar(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return fullName.trim()
  const first = parts[0]!
  const last = parts[parts.length - 1]!
  if (last.length <= 1) return fullName.trim()
  return `${first} ${last[0]}.`
}

export function buildShiftBarTooltipLines(p: {
  employeeName: string
  start: string
  end: string
  plannedStart?: string
  plannedEnd?: string
  stampedStart?: string
  stampedEnd?: string
  stampSource?: string
  areaLabel: string
  shiftTypeLabel: string
  status?: string
  dateLabel?: string
  pendingApproval?: boolean
}): string {
  const planLine =
    p.plannedStart && p.plannedEnd
      ? `Plan: ${p.plannedStart}–${p.plannedEnd} Uhr`
      : `${p.start}–${p.end} Uhr`
  const lines = [
    p.employeeName,
    p.dateLabel,
    planLine,
    p.stampedStart
      ? `Gestempelt: ${p.stampedStart}–${p.stampedEnd ?? 'läuft'} Uhr`
      : null,
    p.stampSource ? `Quelle: ${p.stampSource}` : null,
    p.areaLabel ? `Arbeitsbereich: ${p.areaLabel}` : null,
    `Schichttyp: ${p.shiftTypeLabel}`,
    p.status ? `Status: ${p.status}` : null,
    p.pendingApproval ? 'Freigabe: ausstehend' : null,
  ]
  return lines.filter((x) => x && String(x).trim()).join('\n')
}

export function formatDateISODe(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return d && m && y ? `${d}.${m}.${y}` : ymd
}

/** Kurz-Token für Balken: „UNBESETZTE FRÜH“ */
export function shiftTypeUpperToken(typeId: ShiftTypeId, label: string): string {
  switch (typeId) {
    case 'frueh':
      return 'FRÜH'
    case 'spaet':
      return 'SPÄT'
    case 'nacht':
      return 'NACHT'
    case 'mittel':
      return 'MITTEL'
    case 'kurz':
      return 'KURZ'
    case 'schule':
      return 'SCHULE'
    case 'sonderdienst':
      return 'SONDER'
    case 'regular':
      return 'SCHICHT'
    default:
      return label.toUpperCase().slice(0, 12)
  }
}

export function requirementGapTooltipTitle(typeId: ShiftTypeId, label: string): string {
  switch (typeId) {
    case 'frueh':
      return 'Unbesetzte Frühschicht'
    case 'spaet':
      return 'Unbesetzte Spätschicht'
    case 'nacht':
      return 'Unbesetzte Nachtschicht'
    case 'mittel':
      return 'Unbesetzte Mittelschicht'
    case 'kurz':
      return 'Unbesetzte Kurzschicht'
    case 'schule':
      return 'Unbesetzte Schulschicht'
    case 'sonderdienst':
      return 'Unbesetzter Sonderdienst'
    case 'regular':
      return 'Unbesetzte Schicht'
    default:
      return `Unbesetzte Schicht (${label})`
  }
}

/** Eine Zeile für Soll-Lücke (rote Balken), abhängig von Balkenbreite (% der Timeline). */
export function buildRequirementGapBarLine(p: {
  typeId: ShiftTypeId
  typeLabel: string
  start: string
  end: string
  widthPercent: number
  /** Nur echte Lücke innerhalb der Soll-Zeit, nicht die komplette Früh/Spät. */
  partialGap?: boolean
}): string {
  const { typeId, typeLabel, start, end, widthPercent, partialGap } = p
  const range = `${start}–${end}`
  if (partialGap) {
    return `⚠ Unbesetzt · ${range}`
  }
  if (widthPercent < 10) {
    return `⚠ ${typeLabel} · ${range}`
  }
  if (widthPercent < 18) {
    return `⚠ ${typeLabel} fehlt · ${range}`
  }
  const upper = shiftTypeUpperToken(typeId, typeLabel)
  return `⚠ UNBESETZTE ${upper} · ${range}`
}

export function buildOpenDbShiftBarLine(p: {
  start: string
  end: string
  areaLabel: string
  widthPercent: number
}): string {
  const range = `${p.start}–${p.end}`
  if (p.widthPercent < 18 || !p.areaLabel.trim()) {
    return `Offen · ${range}`
  }
  return `Offen · ${range} · ${p.areaLabel.trim()}`
}

export function buildOpenShiftBlockTooltip(p: {
  mode: 'requirement' | 'open'
  typeId: ShiftTypeId
  typeLabel: string
  start: string
  end: string
  areaLabel: string
  dateISO: string
  stationName?: string
  /** Nur Teil-Lücke im Soll (mehrere Schichten decken den Rest). */
  partialGap?: boolean
}): string {
  const dateDe = formatDateISODe(p.dateISO)
  const areaLine = p.areaLabel.trim() ? `Arbeitsbereich: ${p.areaLabel.trim()}` : null

  if (p.mode === 'requirement') {
    const head = p.partialGap
      ? `Unbesetzter Zeitraum (${p.typeLabel})`
      : requirementGapTooltipTitle(p.typeId, p.typeLabel)
    return [head, `Datum: ${dateDe}`, `${p.start}–${p.end} Uhr`, areaLine, p.stationName ? `Station: ${p.stationName}` : null]
      .filter((x): x is string => Boolean(x && x.trim()))
      .join('\n')
  }

  return [
    'Offene Schicht',
    `Datum: ${dateDe}`,
    `${p.start}–${p.end} Uhr`,
    areaLine,
    `Schichttyp: ${p.typeLabel}`,
    p.stationName ? `Station: ${p.stationName}` : null,
  ]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join('\n')
}
