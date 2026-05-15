import type { HTMLAttributes, ReactNode } from 'react'

const tones = {
  default: 'bg-[var(--badge-bg)] text-[var(--text-muted)] border-[var(--border-soft)]',
  cyan: 'bg-[var(--badge-info-bg)] text-[var(--badge-info-text)] border-[var(--badge-info-border)]',
  lime: 'bg-[var(--badge-lime-bg)] text-[var(--badge-lime-text)] border-[var(--badge-lime-border)]',
  pink: 'bg-[var(--badge-pink-bg)] text-[var(--badge-pink-text)] border-[var(--badge-pink-border)]',
  amber: 'bg-[var(--badge-warn-bg)] text-[var(--badge-warn-text)] border-[var(--badge-warn-border)]',
  danger: 'bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)] border-[var(--badge-danger-border)]',
  success: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border-[var(--badge-success-border)]',
} as const

type Tone = keyof typeof tones

type Props = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: Tone
}

export function Badge({
  children,
  tone = 'default',
  className = '',
  ...rest
}: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
