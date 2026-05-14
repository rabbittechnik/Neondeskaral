import { useState } from 'react'
import { Button } from '../ui/Button'

export type BakingItemSnapshot = {
  itemId: string | null
  name: string
  quantity: number
  unit: string
  category: string | null
  line: string
}

export type BakingNoticePayload = {
  timeEntryId: string
  routineType: 'weekday' | 'weekend' | 'holiday' | string
  routineId: string | null
  title: string
  items: string[]
  itemSnapshots: BakingItemSnapshot[]
}

type Props = {
  open: boolean
  payload: BakingNoticePayload | null
  onDismiss: () => void
  onConfirm: (remark: string) => void | Promise<void>
  submitting?: boolean
}

export function BakingNoticeModal({ open, payload, onDismiss, onConfirm, submitting }: Props) {
  const [remark, setRemark] = useState('')
  if (!open || !payload) return null

  const handleOk = () => {
    void onConfirm(remark.trim())
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="baking-notice-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-400/30 bg-[var(--bg-elevated)] p-5 shadow-xl"
      >
        <h2 id="baking-notice-title" className="text-lg font-semibold text-[var(--text-main)]">
          {payload.title?.trim() || 'Backwaren'}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Bitte beachte die Backwaren-Vorgabe für die Frühschicht.
        </p>
        <p className="mt-4 text-sm font-medium text-[var(--text-main)]">Liste:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text-muted)]">
          {payload.items.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <label className="mt-4 block text-xs font-medium text-[var(--text-faint)]" htmlFor="baking-remark">
          Bemerkung optional
        </label>
        <textarea
          id="baking-remark"
          rows={3}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Falls etwas fehlt oder nicht aufgebacken werden kann, bitte hier eintragen…"
          className="mt-1 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
        />
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={submitting} onClick={handleOk}>
            {submitting ? 'Speichern…' : 'OK, verstanden'}
          </Button>
          <Button type="button" variant="ghost" disabled={submitting} onClick={onDismiss}>
            Schließen
          </Button>
        </div>
      </div>
    </div>
  )
}
