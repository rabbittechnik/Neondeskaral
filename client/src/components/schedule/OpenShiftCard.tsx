import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { getShiftTypeDef, workAreaLabel } from '../../data/mockSchedule'
import { ShiftTimeBadge } from './ShiftTimeBadge'

type Props = {
  block: ResolvedShiftBlock
  onSelect?: (block: ResolvedShiftBlock) => void
}

export function OpenShiftCard({ block, onSelect }: Props) {
  const area = workAreaLabel(block.workAreaCode) || block.workAreaCode || '—'
  const typeLabel = getShiftTypeDef(block.type).label

  return (
    <button
      type="button"
      onClick={() => onSelect?.(block)}
      className="group max-w-[min(100%,280px)] min-w-[200px] flex-1 rounded-[10px] border border-red-400/45 bg-gradient-to-br from-red-500/20 via-orange-500/12 to-transparent px-3 py-2.5 text-left shadow-[0_0_18px_rgba(248,113,113,0.22)] transition hover:shadow-[0_0_22px_rgba(248,113,113,0.35)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-400/60"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-100/95">
        Offene Schicht
      </p>
      <div className="mt-1">
        <ShiftTimeBadge
          start={block.start}
          end={block.end}
          className="text-orange-50/95"
        />
      </div>
      <p className="mt-1 text-xs font-medium text-[var(--text-main)]">{area}</p>
      <p className="mt-0.5 text-[10px] text-orange-200/90">Unbesetzt · {typeLabel}</p>
    </button>
  )
}
