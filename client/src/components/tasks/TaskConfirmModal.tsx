import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  onConfirm: (comment: string) => void
}

export function TaskConfirmModal({ open, title, onClose, onConfirm }: Props) {
  const [comment, setComment] = useState('')
  useEffect(() => {
    if (open) setComment('')
  }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-[var(--text-main)]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-3 block text-xs text-[var(--text-muted)]">
          Kommentar (optional)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="button" onClick={() => onConfirm(comment.trim())}>
            Aufgabe erledigt bestätigen
          </Button>
        </div>
      </div>
    </div>
  )
}
