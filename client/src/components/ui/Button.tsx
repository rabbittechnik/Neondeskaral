import type { ButtonHTMLAttributes, ReactNode } from 'react'

const variants = {
  primary:
    'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/50 hover:bg-[var(--accent-cyan)]/30 shadow-[var(--glow-cyan)]',
  ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]',
  outline:
    'bg-transparent border border-[var(--border-strong)] text-[var(--text-main)] hover:border-[var(--accent-cyan)]/50',
  danger:
    'bg-red-500/10 text-red-300 border border-red-400/40 hover:bg-red-500/20',
} as const

type Variant = keyof typeof variants

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  leftIcon?: ReactNode
  children: ReactNode
}

export function Button({
  variant = 'primary',
  type = 'button',
  leftIcon,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-cyan)] disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  )
}
