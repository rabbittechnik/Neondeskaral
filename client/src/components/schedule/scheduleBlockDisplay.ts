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
  areaLabel: string
  shiftTypeLabel: string
  status?: string
  dateLabel?: string
}): string {
  const lines = [
    p.employeeName,
    p.dateLabel,
    `${p.start}–${p.end} Uhr`,
    p.areaLabel ? `Arbeitsbereich: ${p.areaLabel}` : null,
    `Schichttyp: ${p.shiftTypeLabel}`,
    p.status ? `Status: ${p.status}` : null,
  ]
  return lines.filter((x) => x && String(x).trim()).join('\n')
}
