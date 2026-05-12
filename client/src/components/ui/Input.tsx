import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...rest }: Props) {
  const inputId = id ?? rest.name
  return (
    <div className="w-full space-y-1.5 text-left">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--text-muted)]"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent-cyan)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/25 ${className}`}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
