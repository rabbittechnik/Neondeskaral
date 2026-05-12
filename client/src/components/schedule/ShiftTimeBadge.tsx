type Props = {
  start: string
  end: string
  className?: string
}

export function ShiftTimeBadge({ start, end, className = '' }: Props) {
  return (
    <span
      className={`inline-flex tabular-nums text-[11px] font-medium text-[var(--text-muted)] ${className}`}
    >
      {start} – {end}
    </span>
  )
}
