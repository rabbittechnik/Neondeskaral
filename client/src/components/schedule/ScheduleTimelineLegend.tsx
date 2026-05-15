import { shiftTypes, type ShiftTypeId } from '../../data/mockSchedule'
import type { ScheduleTimelineVariant } from './timelineLayout'

const ORDER: ShiftTypeId[] = ['frueh', 'spaet', 'nacht', 'schule']

type Props = {
  variant?: ScheduleTimelineVariant
}

export function ScheduleTimelineLegend({ variant = 'full' }: Props) {
  const compact = variant === 'compact'
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 ${
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5'
      }`}
    >
      <span
        className={`font-medium text-[var(--text-muted)] ${compact ? 'text-[10px]' : 'text-xs'}`}
      >
        Legende:
      </span>
      {ORDER.map((id) => {
        const t = shiftTypes.find((x) => x.id === id)
        if (!t) return null
        return (
          <span
            key={id}
            className={`schedule-legend-pill inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/25 text-[var(--text-muted)] ${
              compact ? 'px-1.5 py-0.5 text-[9px]' : 'gap-1.5 px-2.5 py-1 text-[11px]'
            }`}
          >
            <span
              className={`shrink-0 rounded-sm border ${t.cardClass} ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}
              aria-hidden
            />
            <span className="schedule-legend-label font-medium text-[var(--text-main)]">{t.label}</span>
            {t.legendTime ? (
              <span className={`tabular-nums text-[var(--text-faint)] ${compact ? 'text-[8px]' : ''}`}>
                {t.legendTime}
              </span>
            ) : null}
          </span>
        )
      })}
      <span
        className={`schedule-open-legend inline-flex items-center gap-1 rounded-full border border-red-400/35 bg-red-500/10 text-orange-100/95 ${
          compact ? 'px-1.5 py-0.5 text-[9px]' : 'gap-1.5 px-2.5 py-1 text-[11px]'
        }`}
      >
        <span
          className={`shrink-0 rounded-sm bg-gradient-to-br from-red-400 to-orange-400 ${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}
          aria-hidden
        />
        Offene Schicht
      </span>
      {!compact ? (
        <span className="text-[10px] text-[var(--text-faint)]">
          Schichtfarben im Plan = Mitarbeiterfarbe · Typ nur als Badge
        </span>
      ) : null}
    </div>
  )
}
