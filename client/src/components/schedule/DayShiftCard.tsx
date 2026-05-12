import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import { hexToRgba } from './scheduleDayUtils'
import { ShiftTimeBadge } from './ShiftTimeBadge'

type Props = {
  block: ResolvedShiftBlock
  employeeName: string
  employeeRole?: string
  accentColor: string
  onSelect?: (block: ResolvedShiftBlock) => void
}

export function DayShiftCard({
  block,
  employeeName,
  employeeRole,
  accentColor,
  onSelect,
}: Props) {
  const area = workAreaLabel(block.workAreaCode) || block.workAreaCode || ''
  const typeDef = getShiftTypeDef(block.type)
  const glow = hexToRgba(accentColor, 0.32)
  const edge = hexToRgba(accentColor, 0.55)
  const wash = hexToRgba(accentColor, 0.11)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(block)}
      style={{
        borderColor: edge,
        boxShadow: `0 0 18px ${glow}, inset 0 1px 0 ${hexToRgba(accentColor, 0.08)}`,
        background: `linear-gradient(135deg, ${wash} 0%, rgba(15,23,42,0.35) 48%, rgba(15,23,42,0.2) 100%)`,
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        borderLeftColor: accentColor,
      }}
      className={`group max-w-[min(100%,280px)] min-w-[200px] flex-1 rounded-[10px] border border-white/12 px-3 py-2.5 text-left transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400/45 ${
        block.conflict
          ? 'ring-2 ring-orange-400/75 ring-offset-1 ring-offset-[var(--bg-card)]'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold leading-snug text-[var(--text-main)]">
          {employeeName}
        </p>
        <span className="shrink-0 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {typeDef.label}
        </span>
      </div>
      {employeeRole ? (
        <p className="mt-0.5 truncate text-[10px] text-[var(--text-faint)]">{employeeRole}</p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[var(--text-muted)]">
        <ShiftTimeBadge start={block.start} end={block.end} className="text-[var(--text-main)]" />
        {area ? (
          <>
            <span className="text-[var(--text-faint)]" aria-hidden>
              ·
            </span>
            <span className="font-medium text-cyan-100/85">{area}</span>
          </>
        ) : null}
      </div>
    </button>
  )
}
