import { useEffect } from 'react'
import { Button } from './Button'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'primary',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDisabled) onCancel()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onCancel, confirmDisabled])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !confirmDisabled) onCancel()
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="confirm-dialog-title"
        className="relative z-10 w-full max-w-md rounded-[var(--radius-md)] border border-orange-400/35 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(251,146,60,0.12),var(--shadow-card)]"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[var(--text-main)]"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onCancel} disabled={confirmDisabled}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
