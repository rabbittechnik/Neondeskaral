import type { MouseEvent, ReactNode } from 'react'

export type LargeReviewModalWidth = 'review' | 'form'

type Props = {
  open: boolean
  /** Für aria-labelledby */
  titleId?: string
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer: ReactNode
  width?: LargeReviewModalWidth
  zIndexClass?: string
  /** Ergänzt den äußeren Panel-Rand (z. B. border-violet-400/35) */
  shellClassName?: string
  onBackdropClose?: () => void
  backdropDisabled?: boolean
}

/**
 * Breites Prüf-/Detail-Modal (Desktop: bis ca. 1200px, mobil: fast volle Breite).
 * Scroll nur im Inhaltsbereich; Footer mit Aktionen bleibt unten sichtbar.
 */
export function LargeReviewModal({
  open,
  titleId = 'large-review-modal-title',
  title,
  subtitle,
  children,
  footer,
  width = 'review',
  zIndexClass = 'z-[90]',
  shellClassName,
  onBackdropClose,
  backdropDisabled = false,
}: Props) {
  if (!open) return null

  const shell =
    width === 'review'
      ? 'w-[min(95vw,1200px)] max-w-[1200px]'
      : 'w-[min(95vw,960px)] max-w-[960px]'

  const borderTone = shellClassName ?? 'border-cyan-500/25'

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4`}
      role="presentation"
      onMouseDown={(e: MouseEvent) => {
        if (e.target === e.currentTarget && !backdropDisabled) onBackdropClose?.()
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className={`flex max-h-[min(94vh,920px)] ${shell} flex-col overflow-hidden rounded-[var(--radius-lg)] border ${borderTone} bg-[var(--bg-elevated)] shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-6">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--text-main)]">
            {title}
          </h2>
          {subtitle ? <div className="mt-1">{subtitle}</div> : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
        <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] sm:px-6">
          <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>
        </footer>
      </div>
    </div>
  )
}

/** Abschnittskarte innerhalb von Prüf-Modals */
export function LargeReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/90">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}
