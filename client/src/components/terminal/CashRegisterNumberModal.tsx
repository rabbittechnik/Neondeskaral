import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { OnScreenNumberPad } from './OnScreenNumberPad'

type Mode = 'check-in' | 'check-out'

type Props = {
  open: boolean
  mode: Mode
  onClose: () => void
  onSubmit: (cardNumber: string) => void
}

export function CashRegisterNumberModal({ open, mode, onClose, onSubmit }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValue('')
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  const title = mode === 'check-in' ? 'Kassennummer eingeben' : 'Kassennummer eingeben'
  const primary = mode === 'check-in' ? 'Schicht starten' : 'Weiter'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/25 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold text-[var(--text-main)]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-6 w-6" />
          </button>
        </div>
        <p className="mt-3 text-base text-[var(--text-muted)]">Bitte gib deine Kassenkartennummer ein.</p>
        <label className="mt-6 block text-sm text-[var(--text-muted)]">
          Kassennummer
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputMode="numeric"
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-black/40 px-4 py-4 text-center text-3xl font-bold tracking-widest text-cyan-100 tabular-nums sm:text-4xl"
          />
        </label>
        <div className="mt-6">
          <OnScreenNumberPad
            value={value}
            onChange={setValue}
            onKey={(k) => {
              if (k === 'ok' && value.trim()) onSubmit(value.trim())
            }}
          />
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="button" disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>
            {primary}
          </Button>
        </div>
      </div>
    </div>
  )
}
