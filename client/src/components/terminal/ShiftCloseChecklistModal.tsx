import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '../ui/Button'
import type { Task } from '../../types/task'

export type ShiftCloseTaskCloseDeclaration = { taskId: string; outcome: 'done' | 'not_done'; notDoneReason?: string }

export type ShiftCloseCompletionPayload = {
  checklist: Record<string, unknown>
  taskCloseDeclarations?: ShiftCloseTaskCloseDeclaration[]
  taskCloseAccuracyConfirmed?: boolean
}

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
  /** Pflicht- und Abschlussaufgaben vor Schichtende (echte DB-Daten) */
  blockingTasks?: Task[]
  /** Stations-Tablet: eine Seite, schnelle Bestätigung, optional „nicht erledigt“ */
  layout?: 'wizard' | 'tablet'
  /** Stations-Tablet / Mitarbeiter-App: feste Mittags-Übergabe (ca. 14:00), nur Schichtende — nicht aus der Aufgabenliste */
  handoverUiMode?: 'midday_standard_collective'
  /** Vom Server, gleiche Reihenfolge wie Snapshot in der DB */
  middayHandoverBullets?: string[]
  /** Button-Text für den finalen Schichtabschluss */
  submitButtonLabel?: string
  onClose: () => void
  onComplete: (payload: ShiftCloseCompletionPayload) => void
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
  blockingTasks,
  layout = 'wizard',
  handoverUiMode,
  middayHandoverBullets,
  submitButtonLabel = 'Schicht beenden',
  onClose,
  onComplete,
}: Props) {
  const [itemsState, setItemsState] = useState<Record<string, ItemState>>(() => initialItemStates(catalogItems))
  const [truth, setTruth] = useState(false)
  const [cashInput, setCashInput] = useState('')
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [tabletMasterDone, setTabletMasterDone] = useState(false)
  const [tabletException, setTabletException] = useState(false)
  const [tabletNotDoneKeys, setTabletNotDoneKeys] = useState<Set<string>>(() => new Set())
  const [tabletReasonByKey, setTabletReasonByKey] = useState<Record<string, string>>({})
  const [blockingOutcome, setBlockingOutcome] = useState<Record<string, 'done' | 'not_done' | ''>>({})
  const [blockingReason, setBlockingReason] = useState<Record<string, string>>({})
  const [middayCollectiveRemark, setMiddayCollectiveRemark] = useState('')

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
      setTabletMasterDone(false)
      setTabletException(false)
      setTabletNotDoneKeys(new Set())
      setTabletReasonByKey({})
      const bo: Record<string, 'done' | 'not_done' | ''> = {}
      for (const t of blockingTasks ?? []) {
        bo[t.id] = ''
      }
      setBlockingOutcome(bo)
      setBlockingReason({})
      setMiddayCollectiveRemark('')
    }
  }, [open, _timeEntryId, catalogItems, blockingTasks])

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
    for (const t of blockingTasks ?? []) {
      const o = blockingOutcome[t.id]
      if (o !== 'done' && o !== 'not_done') {
        return 'Bitte alle markierten Aufgaben als „Erledigt“ oder „Nicht erledigt“ kennzeichnen.'
      }
      if (o === 'not_done' && !String(blockingReason[t.id] ?? '').trim()) {
        return `„Warum nicht erledigt?“ ist erforderlich: ${t.title}`
      }
    }
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
    const checklistPayload: Record<string, unknown> = {
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
    const decl =
      blockingTasks && blockingTasks.length > 0
        ? blockingTasks.map((t) => ({
            taskId: t.id,
            outcome: blockingOutcome[t.id] === 'done' ? ('done' as const) : ('not_done' as const),
            notDoneReason: blockingOutcome[t.id] === 'not_done' ? blockingReason[t.id]?.trim() : undefined,
          }))
        : undefined
    onComplete({
      checklist: checklistPayload,
      taskCloseDeclarations: decl,
      taskCloseAccuracyConfirmed: blockingTasks && blockingTasks.length > 0 ? truth : undefined,
    })
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

  if (layout === 'tablet') {
    const isMiddayCollective =
      handoverUiMode === 'midday_standard_collective' && (middayHandoverBullets?.length ?? 0) > 0
    const titleT = isMiddayCollective ? 'Schichtübergabe' : checklistType === 'handover' ? 'Schichtübergabe' : 'Ladenschluss'
    const descT = isMiddayCollective
      ? 'Bitte prüfe vor dem Beenden deiner Schicht, ob alle Punkte für die Übergabe an die nächste Schicht erledigt sind.'
      : checklistType === 'handover'
        ? 'Bitte prüfe, ob die Übergabe für die nächste Schicht vorbereitet ist. Unten bestätigst du den Abschluss.'
        : 'Bitte bestätige, dass die Tankstelle ordnungsgemäß abgeschlossen wurde. Unten bestätigst du den Abschluss.'

    const submitTablet = () => {
      setError('')
      const cash =
        isMiddayCollective && catalogItems.length === 0
          ? ({ ok: true as const, value: 0 })
          : parseCashEuro(cashInput)
      if (!cash.ok) {
        setError(cash.error)
        return
      }
      for (const t of blockingTasks ?? []) {
        const o = blockingOutcome[t.id]
        if (o !== 'done' && o !== 'not_done') {
          setError('Bitte alle markierten Aufgaben als „Erledigt“ oder „Nicht erledigt“ kennzeichnen.')
          return
        }
        if (o === 'not_done' && !String(blockingReason[t.id] ?? '').trim()) {
          setError(`„Warum nicht erledigt?“ ist erforderlich: ${t.title}`)
          return
        }
      }
      const decl =
        blockingTasks && blockingTasks.length > 0
          ? blockingTasks.map((t) => ({
              taskId: t.id,
              outcome: blockingOutcome[t.id] === 'done' ? ('done' as const) : ('not_done' as const),
              notDoneReason: blockingOutcome[t.id] === 'not_done' ? blockingReason[t.id]?.trim() : undefined,
            }))
          : undefined

      if (isMiddayCollective) {
        if (!tabletMasterDone) {
          setError(
            blockingTasks?.length
              ? 'Bitte bestätigen, dass die Angaben zu den Aufgaben und die Schichtübergabe korrekt sind.'
              : 'Bitte bestätigen, dass alle aufgeführten Aufgaben zur Schichtübergabe erledigt sind.',
          )
          return
        }
        onComplete({
          checklist: {
            checklistType: 'handover',
            submissionKind: 'midday_collective',
            confirmTruth: true,
            collectiveConfirmed: true,
            remark: middayCollectiveRemark.trim() || undefined,
            snapshotVersion: 1,
          },
          taskCloseDeclarations: decl,
          taskCloseAccuracyConfirmed: blockingTasks?.length ? tabletMasterDone : undefined,
        })
        return
      }

      const buildChecklistItems = (
        itemsMap: { itemKey: string; itemLabel: string; answer: string; reason?: string }[],
      ): Record<string, unknown> => ({
        checklistType,
        confirmTruth: true,
        cashDifference: cash.value,
        items: itemsMap,
      })
      const pushComplete = (itemsMap: { itemKey: string; itemLabel: string; answer: string; reason?: string }[]) => {
        onComplete({
          checklist: buildChecklistItems(itemsMap),
          taskCloseDeclarations: decl,
          taskCloseAccuracyConfirmed: blockingTasks?.length ? tabletMasterDone : undefined,
        })
      }
      if (!tabletException) {
        if (!tabletMasterDone) {
          setError(
            blockingTasks?.length
              ? 'Bitte bestätigen, dass die Angaben zu Aufgaben und Checkliste korrekt sind.'
              : 'Bitte bestätigen, dass alle oben genannten Punkte erledigt wurden.',
          )
          return
        }
        pushComplete(
          catalogItems.map((it) => ({
            itemKey: it.key,
            itemLabel: it.label,
            answer: 'yes',
          })),
        )
        return
      }
      if (tabletNotDoneKeys.size === 0) {
        setError('Bitte mindestens einen nicht erledigten Punkt auswählen oder zur Schnellbestätigung zurückkehren.')
        return
      }
      for (const k of tabletNotDoneKeys) {
        const r = (tabletReasonByKey[k] ?? '').trim()
        if (!r) {
          setError(`Begründung erforderlich: ${catalogItems.find((x) => x.key === k)?.label ?? k}`)
          return
        }
      }
      if (!tabletMasterDone) {
        setError(
          blockingTasks?.length
            ? 'Bitte bestätigen, dass die Angaben zu Aufgaben und Checkliste korrekt sind.'
            : 'Bitte die Bestätigung am Ende setzen.',
        )
        return
      }
      pushComplete(
        catalogItems.map((it) => ({
          itemKey: it.key,
          itemLabel: it.label,
          answer: tabletNotDoneKeys.has(it.key) ? 'no' : 'yes',
          reason: tabletNotDoneKeys.has(it.key) ? tabletReasonByKey[it.key]?.trim() : undefined,
        })),
      )
    }

    const tabletSectionList =
      checklistType === 'handover'
        ? [{ id: '_ho', label: 'Übergabe vorbereiten', items: catalogItems }]
        : (() => {
            const wiz =
              wizardGroups && wizardGroups.length > 0 ? wizardGroups : fallbackWizardFromItems(catalogItems)
            return wiz.map((g) => ({
              id: g.id,
              label: g.label,
              items: catalogItems.filter((i) => g.itemKeys.includes(i.key)),
            }))
          })()

    const toggleNotDone = (key: string) => {
      setTabletNotDoneKeys((prev) => {
        const n = new Set(prev)
        if (n.has(key)) n.delete(key)
        else n.add(key)
        return n
      })
    }

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-4">
        <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
        <div className="relative my-4 w-full max-w-3xl rounded-2xl border border-orange-400/30 bg-[var(--bg-card)] p-5 shadow-[0_0_40px_rgba(251,146,60,0.12)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">
                {titleT} — {employeeName}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{descT}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
              <X className="h-6 w-6" />
            </button>
          </div>

          {blockingTasks && blockingTasks.length > 0 ? (
            <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold text-amber-100">
                Vor dem Schichtabschluss müssen noch folgende Aufgaben geprüft werden:
              </p>
              <ul className="mt-3 space-y-4">
                {blockingTasks.map((t) => {
                  const o = blockingOutcome[t.id] ?? ''
                  const mandatory = Boolean((t as { blockingMandatory?: boolean }).blockingMandatory)
                  const close = Boolean((t as { blockingShiftClose?: boolean }).blockingShiftClose)
                  return (
                    <li key={t.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[var(--text-main)]">{t.title}</p>
                        {mandatory ? (
                          <span className="rounded border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
                            Pflicht
                          </span>
                        ) : null}
                        {close ? (
                          <span className="rounded border border-cyan-400/40 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100">
                            Abschluss
                          </span>
                        ) : null}
                      </div>
                      {t.timeCaption ? <p className="mt-1 text-xs text-[var(--text-muted)]">{t.timeCaption}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={o === 'done' ? 'primary' : 'outline'}
                          className="min-h-[44px] flex-1"
                          onClick={() => setBlockingOutcome((prev) => ({ ...prev, [t.id]: 'done' }))}
                        >
                          Erledigt
                        </Button>
                        <Button
                          type="button"
                          variant={o === 'not_done' ? 'primary' : 'outline'}
                          className="min-h-[44px] flex-1 border-rose-400/40 text-rose-100"
                          onClick={() => setBlockingOutcome((prev) => ({ ...prev, [t.id]: 'not_done' }))}
                        >
                          Nicht erledigt
                        </Button>
                      </div>
                      {o === 'not_done' ? (
                        <label className="mt-3 block text-sm text-[var(--text-muted)]">
                          Warum wurde diese Aufgabe nicht erledigt? <span className="text-rose-300">*</span>
                          <textarea
                            value={blockingReason[t.id] ?? ''}
                            onChange={(e) => setBlockingReason((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-rose-400/30 bg-black/40 px-3 py-2 text-[var(--text-main)]"
                          />
                        </label>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {isMiddayCollective && middayHandoverBullets && middayHandoverBullets.length > 0 ? (
            <div className="mt-5 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
              <p className="text-sm font-semibold text-cyan-100">Schichtübergabe — Prüfliste</p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-[var(--text-main)]">
                {middayHandoverBullets.map((line) => (
                  <li key={line} className="pl-1 marker:text-cyan-400">
                    {line}
                  </li>
                ))}
              </ul>
              <label className="mt-4 block text-sm text-[var(--text-muted)]">
                Bemerkung / Mitteilung <span className="text-[var(--text-faint)]">optional</span>
                <textarea
                  value={middayCollectiveRemark}
                  onChange={(e) => setMiddayCollectiveRemark(e.target.value)}
                  rows={3}
                  placeholder="Falls du der nächsten Schicht oder der Leitung etwas mitteilen möchtest…"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
                />
              </label>
            </div>
          ) : null}

          {!isMiddayCollective ? (
            <div className="mt-4 max-h-[min(52vh,480px)] overflow-y-auto pr-1">
              {tabletSectionList.map((sec) => (
                <div key={sec.id} className="mb-6 last:mb-2">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-cyan-200/90">{sec.label}</p>
                  <ul className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    {sec.items.map((it) => (
                      <li
                        key={it.key}
                        className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/25 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <span className="text-base font-medium leading-snug text-[var(--text-main)]">{it.label}</span>
                        {tabletException ? (
                          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-amber-100">
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-white/25"
                              checked={tabletNotDoneKeys.has(it.key)}
                              onChange={() => toggleNotDone(it.key)}
                            />
                            <span>Nicht erledigt</span>
                          </label>
                        ) : null}
                        {tabletException && tabletNotDoneKeys.has(it.key) ? (
                          <label className="mt-1 block w-full text-sm text-[var(--text-muted)] sm:col-span-2">
                            Grund <span className="text-rose-300">*</span>
                            <textarea
                              value={tabletReasonByKey[it.key] ?? ''}
                              onChange={(e) =>
                                setTabletReasonByKey((prev) => ({ ...prev, [it.key]: e.target.value }))
                              }
                              rows={2}
                              className="mt-1 w-full rounded-lg border border-amber-400/30 bg-black/40 px-3 py-2 text-base text-[var(--text-main)]"
                            />
                          </label>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            {!tabletException ? (
              <label className="flex cursor-pointer items-start gap-3 text-base text-[var(--text-main)]">
                <input
                  type="checkbox"
                  className="mt-1 h-6 w-6 shrink-0 rounded border-white/25"
                  checked={tabletMasterDone}
                  onChange={(e) => setTabletMasterDone(e.target.checked)}
                />
                <span>
                  {isMiddayCollective
                    ? blockingTasks?.length
                      ? 'Ich bestätige, dass die Angaben zu den Aufgaben korrekt sind und alle aufgeführten Aufgaben zur Schichtübergabe erledigt sind.'
                      : 'Ich bestätige, alle aufgeführten Aufgaben zur Schichtübergabe erledigt zu haben.'
                    : blockingTasks?.length
                      ? 'Ich bestätige, dass die Angaben zu den Aufgaben und der Checkliste korrekt sind.'
                      : 'Ich bestätige, dass alle oben genannten Punkte erledigt wurden.'}
                </span>
              </label>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-cyan-300 underline-offset-2 hover:underline"
                onClick={() => {
                  setTabletException(false)
                  setTabletNotDoneKeys(new Set())
                  setTabletReasonByKey({})
                }}
              >
                Zurück zur Schnellbestätigung
              </button>
            )}
            {!isMiddayCollective && !tabletException ? (
              <button
                type="button"
                className="text-sm font-medium text-amber-200/95 underline-offset-2 hover:underline"
                onClick={() => {
                  setTabletException(true)
                  setTabletMasterDone(false)
                }}
              >
                Etwas wurde nicht erledigt
              </button>
            ) : null}
            {!isMiddayCollective ? (
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
              </label>
            ) : null}
          </div>

          {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" type="button" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              type="button"
              className="min-h-[52px] min-w-[200px] text-lg font-semibold"
              disabled={isMiddayCollective ? !tabletMasterDone : false}
              onClick={submitTablet}
            >
              {submitButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    )
  }

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
