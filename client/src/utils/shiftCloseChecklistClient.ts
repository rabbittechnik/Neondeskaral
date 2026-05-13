import type { ShiftCloseCatalogItem, ShiftCloseWizardGroup } from '../components/terminal/ShiftCloseChecklistModal'

export function normalizeShiftCloseCatalogItems(raw: unknown[]): ShiftCloseCatalogItem[] {
  return raw.map((row) => {
    const o = row as Record<string, unknown>
    const am = o.answerMode ?? o.answer_mode
    return {
      key: String(o.key ?? ''),
      label: String(o.label ?? ''),
      group: o.group != null && String(o.group).trim() !== '' ? String(o.group) : null,
      groupLabel:
        o.groupLabel != null ? String(o.groupLabel) : o.group_label != null ? String(o.group_label) : null,
      answerMode: am === 'yes_no_not_relevant' ? 'yes_no_not_relevant' : 'yes_no',
    }
  })
}

export function parseShiftCloseWizardGroups(raw: unknown): ShiftCloseWizardGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw
    .map((w) => {
      const x = w as Record<string, unknown>
      const keys = Array.isArray(x.itemKeys) ? (x.itemKeys as unknown[]).map((k) => String(k)) : []
      return { id: String(x.id ?? ''), label: String(x.label ?? ''), itemKeys: keys }
    })
    .filter((g) => g.id && g.itemKeys.length > 0)
  return out.length > 0 ? out : undefined
}
