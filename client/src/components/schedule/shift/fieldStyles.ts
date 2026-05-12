export const inputClass =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-faint)] shadow-inner shadow-black/20 focus:border-cyan-400/55 focus:outline-none focus:ring-2 focus:ring-cyan-400/15'

export const selectClass =
  `${inputClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9` +
  ` [background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")]`

export const labelClass = 'mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-muted)]'
