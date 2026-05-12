import { WORK_AREA_DEFINITIONS } from '../../data/mockEmployees'

export function WorkAreaBadges({
  workAreaIds,
  max = 6,
  className = '',
}: {
  workAreaIds: string[]
  max?: number
  className?: string
}) {
  const list = workAreaIds
    .map((id) => WORK_AREA_DEFINITIONS.find((w) => w.id === id))
    .filter(Boolean) as typeof WORK_AREA_DEFINITIONS
  const shown = list.slice(0, max)
  const more = list.length - shown.length

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {shown.map((w) => (
        <span
          key={w.id}
          className="inline-flex items-center rounded border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-main)]"
          style={{
            borderColor: `${w.color}55`,
            boxShadow: `0 0 8px ${w.color}22`,
          }}
          title={w.name}
        >
          {w.shortCode}
        </span>
      ))}
      {more > 0 ? (
        <span className="text-[9px] text-[var(--text-faint)]">+{more}</span>
      ) : null}
    </div>
  )
}
