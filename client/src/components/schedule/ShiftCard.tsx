import type { ResolvedShiftBlock } from '../../data/mockSchedule'
import { resolveShiftVisual, workAreaLabel } from '../../data/mockSchedule'
import { Badge } from '../ui/Badge'

type Props = {
  block: ResolvedShiftBlock
}

export function ShiftCard({ block }: Props) {
  const visual = resolveShiftVisual(block.type)
  const isFree = block.type === 'frei'
  const timeStr =
    isFree || !block.start
      ? 'Frei'
      : `${block.start} – ${block.end}`
  const areaName = workAreaLabel(block.workAreaCode)
  const tooltip = [
    timeStr,
    areaName ? `${block.workAreaCode} · ${areaName}` : '',
    block.status,
    block.conflict ? 'Hinweis: Konflikt / Prüfung nötig' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      title={tooltip}
      className={`group w-full rounded-[8px] border px-2 py-1.5 text-left text-[11px] font-medium leading-tight transition cursor-pointer
        ${visual.cardClass}
        ${visual.glowClass}
        hover:scale-[1.02] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400/50
        ${block.conflict ? 'ring-2 ring-orange-400/80 ring-offset-1 ring-offset-[var(--bg-card)] shadow-[0_0_12px_rgba(251,146,60,0.35)]' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="tabular-nums text-[10px] opacity-95">{timeStr}</span>
        {block.workAreaCode ? (
          <span className="shrink-0 rounded bg-black/25 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
            {block.workAreaCode}
          </span>
        ) : null}
      </div>
      {!isFree && block.status ? (
        <div className="mt-1">
          <Badge
            tone={block.status === 'Veröffentlicht' ? 'success' : 'amber'}
            className="text-[9px] px-1.5 py-0"
          >
            {block.status}
          </Badge>
        </div>
      ) : null}
      <span className="sr-only">{tooltip}</span>
    </button>
  )
}
