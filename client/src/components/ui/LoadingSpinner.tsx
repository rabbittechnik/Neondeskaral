type Props = {
  label?: string
  className?: string
}

export function LoadingSpinner({
  label = 'Laden…',
  className = '',
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)] ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--accent-cyan)]" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
