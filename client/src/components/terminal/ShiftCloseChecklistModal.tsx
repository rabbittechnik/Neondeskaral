import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '../ui/Button'

export type ShiftCloseAnswerMode = 'yes_no' | 'yes_no_not_relevant'

export type ShiftCloseCatalogItem = {
  key: string
  label: string
  group?: string | null
  groupLabel?: string | null
  answerMode?: ShiftCloseAnswerMode
}

export type ShiftCloseWizardGroup = {
  id: string
  label: string
  itemKeys: string[]
}

export type ShiftCloseChecklistKind = 'handover' | 'closing'

type ItemAnswer = 'yes' | 'no' | 'not_relevant' | ''

type ItemState = {
  answer: ItemAnswer
  reason: string
}

type Props = {
  open: boolean
  employeeName: string
  timeEntryId: string
  employeeId: string
  checklistType: ShiftCloseChecklistKind
  /** Vom Server (station_shift_close_checklist_defs), nicht hardcodiert */
  catalogItems: ShiftCloseCatalogItem[]
  /** Wizard-Schritte für Ladenschluss — vom Server vorberechnet, optional */
  wizardGroups?: ShiftCloseWizardGroup[] | null
  onClose: () => void
  onComplete: (checklist: Record<string, unknown>) => void
}

function itemAllowsNotRelevant(it: ShiftCloseCatalogItem): boolean {
  return it.answerMode === 'yes_no_not_relevant'
}

function fallbackWizardFromItems(items: ShiftCloseCatalogItem[]): ShiftCloseWizardGroup[] {
  const order: ShiftCloseWizardGroup[] = []
  const map = new Map<string, ShiftCloseWizardGroup>()
  for (const it of items) {
    const has = it.group && String(it.group).trim() !== ''
    const id = has ? String(it.group).trim() : '_other'
    const label = has ? String(it.groupLabel ?? it.group).trim() || id : 'Sonstiges'
    let g = map.get(id)
    if (!g) {
      g = { id, label, itemKeys: [] }
      map.set(id, g)
      order.push(g)
    }
    g!.itemKeys.push(it.key)
  }
  return order.length > 0 ? order : [{ id: '_all', label: 'Checkliste', itemKeys: items.map((i) => i.key) }]
}

function initialItemStates(items: ShiftCloseCatalogItem[]): Record<string, ItemState> {
  const o: Record<string, ItemState> = {}
  for (const it of items) {
    o[it.key] = { answer: '', reason: '' }
  }
  return o
}

function parseCashEuro(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = raw.trim().replace(/\s/g, '')
  if (t === '') return { ok: true, value: 0 }
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n)) return { ok: false, error: 'Kassendifferenz konnte nicht gelesen werden (z. B. 0, −5 oder +2,5).' }
  if (Math.abs(n) > 1_000_000) return { ok: false, error: 'Kassendifferenz ist zu groß.' }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

export function ShiftCloseChecklistModal({
  open,
  employeeName,
  timeEntryId: _timeEntryId,
  employeeId: _employeeId,
  checklistType,
  catalogItems,
  wizardGroups,
  onClose,
  onComplete,
}: Props) {
  const [itemsState, setItemsState] = useState<Record<string, ItemState>>(() => initialItemStates(catalogItems))
  const [truth, setTruth] = useState(false)
  const [cashInput, setCashInput] = useState('')
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)

  const isClosing = checklistType === 'closing'

  const effectiveWizard = useMemo(() => {
    if (!isClosing) return null
    if (wizardGroups && wizardGroups.length > 0) return wizardGroups
    return fallbackWizardFromItems(catalogItems)
  }, [isClosing, wizardGroups, catalogItems])

  const maxStep = isClosing && effectiveWizard ? effectiveWizard.length : 0

  useEffect(() => {
    if (open) {
      setItemsState(initialItemStates(catalogItems))
      setTruth(false)
      setCashInput('')
      setError('')
      setStep(0)
    }
  }, [open, _timeEntryId, catalogItems])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const total = catalogItems.length
  const answeredCount = useMemo(() => {
    return catalogItems.filter((it) => {
      const s = itemsState[it.key]
      return s && s.answer !== ''
    }).length
  }, [catalogItems, itemsState])

  const itemsForCurrentStep = useMemo(() => {
    if (!isClosing || !effectiveWizard) return catalogItems
    const g = effectiveWizard[step]
    if (!g) return []
    const keys = new Set(g.itemKeys)
    return catalogItems.filter((i) => keys.has(i.key))
  }, [catalogItems, effectiveWizard, isClosing, step])

  const setAnswer = (key: string, answer: ItemAnswer) => {
    setItemsState((prev) => ({
      ...prev,
      [key]: { ...prev[key], answer, reason: answer === 'no' ? prev[key]?.reason ?? '' : prev[key]?.reason ?? '' },
    }))
  }

  const setReason = (key: string, reason: string) => {
    setItemsState((prev) => ({ ...prev, [key]: { ...prev[key], reason } }))
  }

  const validationError = (): string | null => {
    for (const it of catalogItems) {
      const s = itemsState[it.key]
      if (!s || s.answer === '') return 'Bitte alle Punkte beantworten.'
      if (s.answer === 'no' && !s.reason.trim()) return `Begründung erforderlich bei „Nein“: ${it.label}`
      if (!itemAllowsNotRelevant(it) && s.answer === 'not_relevant') {
        return `Nur „Ja“ oder „Nein“ erlaubt: ${it.label}`
      }
    }
    if (!truth) return 'Bitte die Wahrheitsbestätigung setzen.'
    const cash = parseCashEuro(cashInput)
    if (!cash.ok) return cash.error
    return null
  }

  const submit = () => {
    const err = validationError()
    if (err) {
      setError(err)
      return
    }
    setError('')
    const cash = parseCashEuro(cashInput)
    if (!cash.ok) return
    const payload: Record<string, unknown> = {
      checklistType,
      confirmTruth: true,
      cashDifference: cash.value,
      items: catalogItems.map((it) => {
        const s = itemsState[it.key]!
        return {
          itemKey: it.key,
          itemLabel: it.label,
          answer: s.answer,
          reason: s.reason.trim() || undefined,
        }
      }),
    }
    onComplete(payload)
  }

  const title =
    checklistType === 'handover' ? 'Schichtübergabe vorbereiten' : 'Ladenschluss / Abschluss-Checkliste'
  const description =
    checklistType === 'handover'
      ? 'Bitte bestätige, was für die nächste Schicht erledigt wurde.'
      : 'Bitte bestätige alle Punkte vor dem Schichtabschluss.'

  const nextStep = () => {
    setError('')
    if (step < maxStep) setStep((s) => s + 1)
  }
  const prevStep = () => {
    setError('')
    if (step > 0) setStep((s) => s - 1)
  }

  const blockNext = useMemo(() => {
    const list = isClosing ? itemsForCurrentStep : catalogItems
    for (const it of list) {
      const s = itemsState[it.key]
      if (!s || s.answer === '') return true
      if (s.answer === 'no' && !s.reason.trim()) return true
    }
    return false
  }, [catalogItems, isClosing, itemsForCurrentStep, itemsState])

  if (!open) return null

  const showSummaryPanel = !isClosing || step === maxStep
  const stepTitle = isClosing && effectiveWizard?.[step] ? effectiveWizard[step]!.label : ''

  const renderAnswerButtons = (it: ShiftCloseCatalogItem, s: ItemState, size: 'lg' | 'md') => {
    const tri = itemAllowsNotRelevant(it)
    const btn =
      size === 'lg'
        ? 'min-h-[52px] min-w-[120px] flex-1 rounded-xl border px-4 py-3 text-lg font-semibold sm:min-w-[140px]'
        : 'min-h-[48px] min-w-[100px] rounded-xl border px-4 py-3 text-base font-semibold'
    if (!tri) {
      return (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setAnswer(it.key, 'yes')}
            className={`${btn} ${
              s.answer === 'yes'
                ? 'border-emerald-400/55 bg-emerald-500/20 text-emerald-100'
                : 'border-white/15 bg-black/30 text-[var(--text-main)] hover:border-emerald-400/35'
            }`}
          >
            Ja
          </button>
          <button
            type="button"
            onClick={() => setAnswer(it.key, 'no')}
            className={`${btn} ${
              s.answer === 'no'
                ? 'border-rose-400/55 bg-rose-500/20 text-rose-100'
                : 'border-white/15 bg-black/30 text-[var(--text-main)] hover:border-rose-400/35'
            }`}
          >
            Nein
          </button>
        </div>
      )
    }
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {(['yes', 'no', 'not_relevant'] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAnswer(it.key, a)}
            className={`${btn} ${
              s.answer === a
                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                : 'border-white/15 bg-black/30 text-[var(--text-main)] hover:border-cyan-400/35'
            }`}
          >
            {a === 'yes' ? 'Ja' : a === 'no' ? 'Nein' : 'Nicht relevant'}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-4">
      <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
      <div className="relative my-4 w-full max-w-3xl rounded-2xl border border-orange-400/30 bg-[var(--bg-card)] p-5 shadow-[0_0_40px_rgba(251,146,60,0.12)] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
              {title} — {employeeName}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
            <p className="mt-2 text-sm font-medium text-cyan-200/90">
              {answeredCount} von {total} Punkten beantwortet
            </p>
            {isClosing ? (
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                Schritt {Math.min(step + 1, maxStep + 1)} von {maxStep + 1}
                {stepTitle ? ` · ${stepTitle}` : ''}
                {step === maxStep ? ' · Abschluss' : ''}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-4 max-h-[min(56vh,520px)] overflow-y-auto pr-1">
          {isClosing && step < maxStep ? (
            <ul className="space-y-4">
              {itemsForCurrentStep.map((it) => {
                const s = itemsState[it.key] ?? { answer: '' as ItemAnswer, reason: '' }
                return (
                  <li key={it.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-base font-medium text-[var(--text-main)]">{it.label}</p>
                    {renderAnswerButtons(it, s, 'md')}
                    {s.answer === 'no' ? (
                      <label className="mt-3 block text-sm text-amber-100/95">
                        Warum wurde es nicht erledigt? <span className="text-rose-300">*</span>
                        <textarea
                          value={s.reason}
                          onChange={(e) => setReason(it.key, e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-amber-400/25 bg-black/40 px-3 py-2 text-base text-[var(--text-main)]"
                        />
                      </label>
                    ) : null}
                    {s.answer === 'not_relevant' ? (
                      <label className="mt-3 block text-sm text-[var(--text-muted)]">
                        Optional: Begründung
                        <textarea
                          value={s.reason}
                          onChange={(e) => setReason(it.key, e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-black/30 px-3 py-2 text-base text-[var(--text-main)]"
                        />
                      </label>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : !isClosing ? (
            <ul className="space-y-4">
              {catalogItems.map((it) => {
                const s = itemsState[it.key] ?? { answer: '' as ItemAnswer, reason: '' }
                return (
                  <li key={it.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-base font-medium text-[var(--text-main)]">{it.label}</p>
                    {renderAnswerButtons(it, s, 'lg')}
                    {s.answer === 'no' ? (
                      <label className="mt-3 block text-sm text-amber-100/95">
                        Warum wurde es nicht erledigt? <span className="text-rose-300">*</span>
                        <textarea
                          value={s.reason}
                          onChange={(e) => setReason(it.key, e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-amber-400/25 bg-black/40 px-3 py-2 text-base text-[var(--text-main)]"
                        />
                      </label>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}

          {isClosing && step === maxStep ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-[var(--text-muted)]">Überblick — bei Bedarf oben die Schritte ändern.</p>
              <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                {catalogItems.map((it) => {
                  const s = itemsState[it.key]!
                  const label =
                    s.answer === 'yes' ? 'Ja' : s.answer === 'no' ? 'Nein' : s.answer === 'not_relevant' ? 'Nicht relevant' : '—'
                  return (
                    <li key={it.key} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                      <span className="text-[var(--text-main)]">{it.label}</span>
                      <span className={s.answer === 'no' ? 'font-semibold text-rose-300' : 'text-cyan-200/90'}>{label}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>

        {showSummaryPanel ? (
          <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--text-main)]">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 rounded border-white/20"
                checked={truth}
                onChange={(e) => setTruth(e.target.checked)}
              />
              <span>Ich bestätige, dass ich die Angaben wahrheitsgemäß gemacht habe.</span>
            </label>
            <label className="block text-sm text-[var(--text-muted)]">
              Kassendifferenz (€){' '}
              <span className="font-normal text-[var(--text-faint)]">— optional</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                className="mt-1 w-full max-w-xs rounded-xl border border-[var(--border-subtle)] bg-black/30 px-3 py-2 font-mono text-base text-[var(--text-main)] tabular-nums"
              />
              <span className="mt-1 block text-xs font-normal leading-snug text-[var(--text-faint)]">
                Nur ausfüllen, wenn eine Kassendifferenz bekannt ist. Beispiele: 0,00 · −5,00 · +2,50
              </span>
            </label>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {isClosing && step > 0 ? (
              <Button variant="ghost" type="button" onClick={prevStep} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" type="button" onClick={onClose}>
              Abbrechen
            </Button>
            {isClosing && step < maxStep ? (
              <Button variant="primary" type="button" disabled={blockNext} onClick={nextStep} className="gap-1">
                Weiter
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="primary" type="button" disabled={Boolean(validationError())} onClick={submit}>
                Schicht jetzt beenden
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
