type Props = {
  name: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? ''
  const b = parts[1]?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export function Avatar({ name, src, size = 'md', className = '' }: Props) {
  const cls = `${sizes[size]} ${className}`
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`rounded-full object-cover ring-2 ring-[var(--border-subtle)] ${cls}`}
      />
    )
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/40 to-fuchsia-500/30 font-semibold text-white ring-2 ring-[var(--border-subtle)] ${cls}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}
