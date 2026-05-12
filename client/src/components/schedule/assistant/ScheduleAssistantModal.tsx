import { X } from 'lucide-react'
import { useEffect } from 'react'
import { ScheduleAssistantWizard } from './ScheduleAssistantWizard'

type Props = {
  open: boolean
  initialWeekStartIso: string
  onClose: () => void
  onApplied: () => void
}

export function ScheduleAssistantModal({ open, initialWeekStartIso, onClose, onApplied }: Props) {
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1 -top-1 z-[2] rounded-full border border-white/15 bg-[var(--bg-card)] p-2 text-[var(--text-muted)] shadow-lg hover:text-[var(--text-main)] sm:right-0 sm:top-0"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
        <ScheduleAssistantWizard
          open={open}
          initialWeekStartIso={initialWeekStartIso}
          onClose={onClose}
          onApplied={onApplied}
        />
      </div>
    </div>
  )
}
