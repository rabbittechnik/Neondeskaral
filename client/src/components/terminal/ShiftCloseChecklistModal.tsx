import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ShiftCloseChecklist } from '../../types/timeTracking'
import { mergeChecklistDraft } from '../../utils/timeTrackingUtils'
import { createChecklistId } from '../../data/mockTimeTracking'
import { Button } from '../ui/Button'

type Props = {
  open: boolean
  employeeName: string
  timeEntryId: string
  employeeId: string
  onClose: () => void
  onComplete: (checklist: ShiftCloseChecklist) => void
}

type Draft = {
  fridgeFronted: boolean
  drinksFilled: boolean
  cigarettesFilled: boolean
  shelvesFilled: boolean
  trashEmptied: boolean
  counterClean: boolean
  coffeeAreaClean: boolean
  outsideChecked: boolean
  incidentsNoted: boolean
  handoverPossible: boolean
  closingReady: boolean
  incidentNote: string
  /** Freitexteingabe Kassendifferenz (€), leer = 0,00 € */
  cashDifferenceInput: string
}

const initialDraft: Draft = {
  fridgeFronted: false,
  drinksFilled: false,
  cigarettesFilled: false,
  shelvesFilled: false,
  trashEmptied: false,
  counterClean: false,
  coffeeAreaClean: false,
  outsideChecked: false,
  incidentsNoted: false,
  handoverPossible: false,
  closingReady: false,
  incidentNote: '',
  cashDifferenceInput: '',
}

const ROWS: { key: keyof Draft; label: string }[] = [
  { key: 'fridgeFronted', label: 'Kühlschrank / Kühlung vorgezogen' },
  { key: 'drinksFilled', label: 'Getränke aufgefüllt' },
  { key: 'cigarettesFilled', label: 'Zigaretten aufgefüllt' },
  { key: 'shelvesFilled', label: 'Regale grob aufgefüllt' },
  { key: 'trashEmptied', label: 'Mülleimer geleert' },
  { key: 'counterClean', label: 'Kassenbereich sauber' },
  { key: 'coffeeAreaClean', label: 'Kaffee- / Backshopbereich sauber' },
  { key: 'outsideChecked', label: 'Außenbereich grob kontrolliert' },
  { key: 'incidentsNoted', label: 'Besondere Vorkommnisse notiert' },
  { key: 'handoverPossible', label: 'Übergabe an nächste Schicht möglich' },
  { key: 'closingReady', label: 'Falls Spätschicht / Schlussdienst: Tankstelle kann ordentlich zugeschlossen werden' },
]

export function ShiftCloseChecklistModal({
  open,
  employeeName,
  timeEntryId,
  employeeId,
  onClose,
  onComplete,
}: Props) {
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDraft(initialDraft)
      setError('')
    }
  }, [open, timeEntryId])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const toggle = (key: keyof Draft) => {
    if (key === 'incidentNote') return
    setDraft((d) => ({ ...d, [key]: !d[key] }))
  }

  const submit = () => {
    const okAll = ROWS.every((r) => Boolean(draft[r.key]))
    if (!okAll && !draft.incidentNote.trim()) {
      setError('Nicht alle Punkte wurden bestätigt. Bitte trage eine Bemerkung ein.')
      return
    }
    let cashEuro = 0
    const rawCash = draft.cashDifferenceInput.trim().replace(/\s/g, '')
    if (rawCash !== '') {
      const normalized = rawCash.replace(',', '.')
      const n = Number(normalized)
      if (!Number.isFinite(n)) {
        setError('Kassendifferenz konnte nicht gelesen werden (zulässig z. B. 0, −5 oder +2,5).')
        return
      }
      if (Math.abs(n) > 1_000_000) {
        setError('Kassendifferenz ist zu groß.')
        return
      }
      cashEuro = Math.round(n * 100) / 100
    }

    setError('')
    const completedAt = new Date().toISOString()
    const merged = mergeChecklistDraft(
      { ...draft, everythingOk: okAll, cashDifference: cashEuro },
      timeEntryId,
      employeeId,
      createChecklistId(),
      completedAt,
    )
    onComplete(merged)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-4">
      <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
      <div className="relative my-4 w-full max-w-2xl rounded-2xl border border-orange-400/30 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(251,146,60,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-main)]">Schichtabschluss für {employeeName}</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Bitte bestätige, dass die wichtigsten Aufgaben erledigt wurden.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-6 w-6" />
          </button>
        </div>
        <ul className="mt-5 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {ROWS.map((r) => (
            <li key={r.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-base text-[var(--text-main)] hover:border-cyan-400/25">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-white/20"
                  checked={Boolean(draft[r.key])}
                  onChange={() => toggle(r.key)}
                />
                <span>{r.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <label className="mt-4 block text-sm text-[var(--text-muted)]">
          Bemerkung / besondere Vorkommnisse
          <textarea
            value={draft.incidentNote}
            onChange={(e) => setDraft((d) => ({ ...d, incidentNote: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-black/30 px-3 py-2 text-base text-[var(--text-main)]"
          />
        </label>
        <label className="mt-4 block text-sm text-[var(--text-muted)]">
          Kassendifferenz (€){' '}
          <span className="font-normal text-[var(--text-faint)]">— optional</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={draft.cashDifferenceInput}
            onChange={(e) => setDraft((d) => ({ ...d, cashDifferenceInput: e.target.value }))}
            className="mt-1 w-full max-w-xs rounded-xl border border-[var(--border-subtle)] bg-black/30 px-3 py-2 font-mono text-base text-[var(--text-main)] tabular-nums"
          />
          <span className="mt-1 block text-xs font-normal leading-snug text-[var(--text-faint)]">
            Nur ausfüllen, wenn eine Kassendifferenz bekannt ist. Beispiele: 0,00 · −5,00 · +2,50
          </span>
        </label>
        <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">Kann die Schicht abgeschlossen werden?</p>
        {error ? <p className="mt-2 text-sm text-amber-300">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="button" onClick={submit}>
            Schicht abschließen
          </Button>
        </div>
      </div>
    </div>
  )
}
