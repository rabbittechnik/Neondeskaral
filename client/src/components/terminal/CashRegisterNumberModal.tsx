import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { OnScreenNumberPad } from './OnScreenNumberPad'

type Mode = 'check-in' | 'check-out'

type Props = {
  open: boolean
  mode: Mode
  onClose: () => void
  /** Kann async sein (Ladezustand bis Promise fertig). */
  onSubmit: (cardNumber: string) => void | Promise<void>
  /** Server-/Client-Fehler unterhalb des Eingabefelds */
  submitError?: string | null
  onClearSubmitError?: () => void
  busy?: boolean
  /** Mindestlänge vor Submit (Standard 4). */
  minDigits?: number
}

export function CashRegisterNumberModal({
  open,
  mode,
  onClose,
  onSubmit,
  submitError,
  onClearSubmitError,
  busy = false,
  minDigits = 4,
}: Props) {
  const [value, setValue] = useState('')
  const [localBusy, setLocalBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const combinedBusy = busy || localBusy
  const displayErr = localErr ?? submitError ?? null

  useEffect(() => {
    if (!open) return
    setValue('')
    setLocalErr(null)
    onClearSubmitError?.()
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, mode, onClearSubmitError])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const setDigits = (v: string) => {
    const cleaned = v.replace(/\D/g, '').slice(0, 8)
    setLocalErr(null)
    if (submitError) onClearSubmitError?.()
    setValue(cleaned)
  }

  const runSubmit = async () => {
    const digits = value.replace(/\D/g, '').trim()
    if (!digits) {
      setLocalErr('Bitte Kassenkartennummer eingeben.')
      return
    }
    if (digits.length < minDigits) {
      setLocalErr('Bitte vollständige Kassenkartennummer eingeben.')
      return
    }
    setLocalBusy(true)
    try {
      await Promise.resolve(onSubmit(digits))
    } finally {
      setLocalBusy(false)
    }
  }

  if (!open) return null

  const title = 'Kassennummer eingeben'
  const primary = mode === 'check-in' ? 'Schicht starten' : 'Weiter'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-register-dialog-title"
        className="relative z-[1] w-full max-w-lg rounded-2xl border border-cyan-500/25 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="cash-register-dialog-title" className="text-2xl font-bold text-[var(--text-main)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10"
            aria-label="Schließen"
            disabled={combinedBusy}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <p className="mt-3 text-base text-[var(--text-muted)]">Bitte gib deine Kassenkartennummer ein.</p>
        <label className="mt-6 block text-sm text-[var(--text-muted)]">
          Kassennummer
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setDigits(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !combinedBusy && value.replace(/\D/g, '').trim().length >= minDigits) {
                e.preventDefault()
                void runSubmit()
              }
            }}
            inputMode="numeric"
            autoComplete="off"
            disabled={combinedBusy}
            className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-black/40 px-4 py-4 text-center text-3xl font-bold tracking-widest text-cyan-100 tabular-nums sm:text-4xl"
          />
        </label>
        {(displayErr ?? '').trim() ? (
          <p className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100" role="alert">
            {displayErr}
          </p>
        ) : null}
        <div className="mt-6">
          <OnScreenNumberPad value={value} onChange={setDigits} showOkKey={false} />
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose} disabled={combinedBusy}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={combinedBusy || value.replace(/\D/g, '').trim().length < minDigits}
            onClick={() => void runSubmit()}
          >
            {combinedBusy ? 'Wird geprüft…' : primary}
          </Button>
        </div>
      </div>
    </div>
  )
}
