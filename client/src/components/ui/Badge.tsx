import type { HTMLAttributes, ReactNode } from 'react'

const tones = {
  default: 'bg-white/5 text-[var(--text-muted)] border-white/10',
  cyan: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  lime: 'bg-lime-500/15 text-lime-200 border-lime-400/30',
  pink: 'bg-pink-500/15 text-pink-200 border-pink-400/30',
  amber: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  danger: 'bg-red-500/15 text-red-200 border-red-400/35',
  success: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
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
