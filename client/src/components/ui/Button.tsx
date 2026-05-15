import type { ButtonHTMLAttributes, ReactNode } from 'react'

const variants = {
  primary:
    'border bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border-[var(--btn-primary-border)] hover:bg-[var(--btn-primary-hover-bg)] shadow-[var(--glow-cyan)]',
  ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]',
  outline:
    'bg-[var(--bg-card)] border border-[var(--border-strong)] text-[var(--text-main)] hover:bg-[var(--surface-hover)] hover:border-[var(--btn-primary-border)]',
  danger:
    'border bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] border-[var(--btn-danger-border)] hover:bg-[var(--btn-danger-hover-bg)]',
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
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] disabled:border-[var(--input-border)] disabled:bg-[var(--btn-disabled-bg)] disabled:text-[var(--btn-disabled-text)] disabled:opacity-100 disabled:shadow-none ${variants[variant]} ${className}`}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  )
}
