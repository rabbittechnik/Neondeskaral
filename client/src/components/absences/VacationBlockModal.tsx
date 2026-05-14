import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { VacationBlock } from '../../types/absence'
import { WORK_AREA_DEFINITIONS } from '../../data/mockEmployees'
import { Button } from '../ui/Button'

type Mode = 'create' | 'edit'

type Props = {
  open: boolean
  mode: Mode
  block: VacationBlock | null
  onClose: () => void
  onSave: (b: VacationBlock) => void
}

function emptyBlock(): VacationBlock {
  return {
    id: '',
    title: '',
    startDate: '',
    endDate: '',
    description: '',
    workAreaIds: [],
    active: true,
  }
}

export function VacationBlockModal({ open, mode, block, onClose, onSave }: Props) {
  const [form, setForm] = useState<VacationBlock>(() => emptyBlock())
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setErrors([])
    if (mode === 'edit' && block) setForm(structuredClone(block))
    else setForm(emptyBlock())
  }, [open, mode, block])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const toggleArea = (id: string) => {
    setForm((f) => ({
      ...f,
      workAreaIds: f.workAreaIds.includes(id)
        ? f.workAreaIds.filter((x) => x !== id)
        : [...f.workAreaIds, id],
    }))
  }

  const submit = () => {
    const err: string[] = []
    if (!form.title.trim()) err.push('Titel fehlt.')
    if (!form.startDate || !form.endDate) err.push('Zeitraum unvollständig.')
    if (form.startDate && form.endDate && form.endDate < form.startDate) err.push('Ende vor Start.')
    if (form.workAreaIds.length === 0) err.push('Mindestens ein Arbeitsbereich.')
    setErrors(err)
    if (err.length > 0) return
    onSave(form)
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
      <div className="relative z-10 max-h-[90vh] w-[min(95vw,1100px)] max-w-[1100px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-main)]">
            {mode === 'create' ? 'Neue Urlaubssperre' : 'Urlaubssperre bearbeiten'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-[var(--text-muted)]">
            Titel *
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-[var(--text-muted)]">
              Start *
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              />
            </label>
            <label className="block text-xs text-[var(--text-muted)]">
              Ende *
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
              />
            </label>
          </div>
          <label className="block text-xs text-[var(--text-muted)]">
            Grund / Beschreibung
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
          </label>
          <fieldset>
            <legend className="text-xs text-[var(--text-muted)]">Arbeitsbereiche *</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WORK_AREA_DEFINITIONS.map((w) => (
                <label key={w.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-[var(--text-main)]">
                  <input type="checkbox" checked={form.workAreaIds.includes(w.id)} onChange={() => toggleArea(w.id)} />
                  {w.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Aktiv
          </label>
        </div>
        {errors.length > 0 ? (
          <ul className="mt-3 list-inside list-disc text-xs text-red-300">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="button" onClick={submit}>
            Speichern
          </Button>
        </div>
      </div>
    </div>
  )
}
