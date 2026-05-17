import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import type { PayrollHolidayCategory, PayrollHolidaySpecialRuleTier, StationHoliday } from '../../types/stationHoliday'
import { PAYROLL_HOLIDAY_CATEGORY_LABELS } from '../../types/stationHoliday'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  mode: Mode
  holiday: StationHoliday | null
  federalState: string
  onClose: () => void
  onSave: (payload: Partial<StationHoliday> & { name: string; date: string }) => void
}

const CATEGORIES: PayrollHolidayCategory[] = ['none', 'regular', 'special', 'special_rule']

function emptyHoliday(federalState: string): StationHoliday {
  return {
    id: '',
    date: '',
    name: '',
    federalState,
    payrollCategory: 'regular',
    specialRuleTier: null,
    referencePercent: 125,
    allDay: true,
    timeStart: null,
    timeEnd: null,
    source: 'custom',
    statutoryTemplateId: null,
    isManualOverride: false,
    active: true,
    note: '',
  }
}

export function HolidayEditModal({ open, mode, holiday, federalState, onClose, onSave }: Props) {
  const [form, setForm] = useState<StationHoliday>(() => emptyHoliday(federalState))
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setErrors([])
    if (mode === 'edit' && holiday) setForm(structuredClone(holiday))
    else setForm(emptyHoliday(federalState))
  }, [open, mode, holiday, federalState])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const submit = () => {
    const err: string[] = []
    if (!form.name.trim()) err.push('Name fehlt.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) err.push('Datum als YYYY-MM-DD.')
    if (form.payrollCategory === 'special_rule' && !form.specialRuleTier) {
      err.push('Bei Sonderregel bitte Feiertagsart wählen (Feiertag oder B.-Feiertag).')
    }
    if (!form.allDay && !form.timeStart?.trim()) err.push('Startzeit fehlt (oder „ganztägig“ aktivieren).')
    setErrors(err)
    if (err.length) return
    onSave({
      ...form,
      name: form.name.trim(),
      date: form.date.trim(),
      note: form.note.trim(),
      referencePercent: Number(form.referencePercent) || 0,
    })
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        className="relative z-10 max-h-[90vh] w-[min(95vw,560px)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]"
        role="dialog"
        aria-labelledby="holiday-edit-title"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="holiday-edit-title" className="text-lg font-semibold text-[var(--text-main)]">
            {mode === 'create' ? 'Zusatz-Feiertag' : 'Feiertag bearbeiten'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Die Kategorie steuert die Lohnberechnung. Der Prozentsatz dient als Hinweis – gezahlt wird der im Mitarbeiterprofil hinterlegte Satz.
        </p>

        {errors.length ? (
          <ul className="mt-3 list-inside list-disc text-sm text-rose-300">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block text-xs text-[var(--text-muted)]">
            Feiertagsname
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-[var(--text-muted)]">
              Datum
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              />
            </label>
            <label className="block text-xs text-[var(--text-muted)]">
              Bundesland
              <input
                value={form.federalState || federalState}
                onChange={(e) => setForm((f) => ({ ...f, federalState: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              />
            </label>
          </div>
          <label className="block text-xs text-[var(--text-muted)]">
            Kategorie
            <select
              value={form.payrollCategory}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  payrollCategory: e.target.value as PayrollHolidayCategory,
                  specialRuleTier:
                    e.target.value === 'special_rule' ? (f.specialRuleTier ?? 'regular') : null,
                }))
              }
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PAYROLL_HOLIDAY_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          {form.payrollCategory === 'special_rule' ? (
            <label className="block text-xs text-[var(--text-muted)]">
              Sonderregel zählt als
              <select
                value={form.specialRuleTier ?? 'regular'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    specialRuleTier: e.target.value as PayrollHolidaySpecialRuleTier,
                  }))
                }
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              >
                <option value="regular">Feiertag (Profil: Feiertagszuschlag %)</option>
                <option value="special">B.-Feiertag (Profil: B.-Feiertagszuschlag %)</option>
              </select>
            </label>
          ) : null}
          <label className="block text-xs text-[var(--text-muted)]">
            Zuschlag in Prozent (Hinweis / Anzeige)
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.referencePercent}
              onChange={(e) => setForm((f) => ({ ...f, referencePercent: Number(e.target.value) }))}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
            />
            Ganztägig
          </label>
          {!form.allDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[var(--text-muted)]">
                Startzeit
                <input
                  type="time"
                  value={form.timeStart ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, timeStart: e.target.value || null }))}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
                />
              </label>
              <label className="block text-xs text-[var(--text-muted)]">
                Endzeit (optional)
                <input
                  type="time"
                  value={form.timeEnd ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, timeEnd: e.target.value || null }))}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
                />
              </label>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Aktiv
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            Notiz
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" onClick={submit}>
            Speichern
          </Button>
        </div>
      </div>
    </div>
  )
}
