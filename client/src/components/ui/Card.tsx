import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const pad = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-6',
} as const

export function Card({
  children,
  className = '',
  padding = 'md',
  ...rest
}: Props) {
  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] ${pad[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
