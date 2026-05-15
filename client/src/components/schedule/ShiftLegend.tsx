import { shiftTypes, type ShiftTypeId } from '../../data/mockSchedule'

const legendOrder: ShiftTypeId[] = [
  'frueh',
  'spaet',
  'nacht',
  'schule',
  'sonderdienst',
  'frei',
  'konflikt',
]

export function ShiftLegend() {
  const items = legendOrder
    .map((id) => shiftTypes.find((t) => t.id === id))
    .filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/80 px-3 py-2.5">
      <span className="text-xs font-medium text-[var(--text-muted)]">Legende:</span>
      {items.map((t) => (
        <span
          key={t!.id}
          className="schedule-legend-pill inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${t!.cardClass}`}
            aria-hidden
          />
          <span className="text-[var(--text-main)]">{t!.label}</span>
          {t!.legendTime ? (
            <span className="text-[var(--text-faint)]">{t!.legendTime}</span>
          ) : null}
        </span>
      ))}
      <span className="text-[10px] text-[var(--text-faint)]">
        Zusätzlich: Mittel, Kurz (Farben im Plan)
      </span>
    </div>
  )
}
