import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import type { ClockCardEmployee } from '../../utils/timeTrackingUtils'
import type { TabletRunningRow } from '../../context/tablet-terminal-context'
import type { ScheduleShift } from '../../data/mockSchedule'
import { toISODateLocal } from '../../utils/taskUtils'
import type { TabletCheckInAllEmployeeRow, TabletCheckInSuggestion } from '../../types/tabletCheckInSuggestions'

type Mode = 'check-in' | 'check-out'

type Props = {
  open: boolean
  mode: Mode
  employees: ClockCardEmployee[]
  runningPresence: TabletRunningRow[]
  shifts: ScheduleShift[]
  checkInSuggestions?: TabletCheckInSuggestion[]
  checkInAllEmployees?: TabletCheckInAllEmployeeRow[]
  checkInSuggestionsLoading?: boolean
  checkInSuggestionsError?: string | null
  checkInSubmitting?: boolean
  checkInSubmitError?: string | null
  onClearCheckInSubmitError?: () => void
  /** Beim Schichtende: Server-Antwort lädt (Checkliste vorbereiten). */
  checkoutBusy?: boolean
  /** Beim Schichtende: Fehler vom check-out-start. */
  checkoutError?: string | null
  onClose: () => void
  onConfirmCheckIn: (employeeId: string, shiftId?: string) => void
  onPickCheckOut: (row: TabletRunningRow) => void
}

function todayShiftLine(shifts: ScheduleShift[], employeeId: string, todayIso: string): string {
  const list = shifts
    .filter(
      (s) =>
        s.employeeId === employeeId &&
        s.date === todayIso &&
        s.shiftType !== 'frei' &&
        Boolean(s.startTime) &&
        Boolean(s.endTime),
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const s = list[0]
  if (!s) return 'Heute keine Schicht'
  return `Heute: ${s.startTime} – ${s.endTime} Uhr`
}

function isClockedIn(runningPresence: TabletRunningRow[], employeeId: string): boolean {
  return runningPresence.some((r) => r.employeeId === employeeId)
}

function suggestionHint(s: TabletCheckInSuggestion): string {
  if (s.status === 'starts_soon') {
    return `Start in ${Math.abs(s.deviationMinutes)} Min.`
  }
  if (s.status === 'should_have_started') {
    if (s.deviationMinutes <= 0) return 'Geplanter Beginn jetzt'
    return `${s.deviationMinutes} Min. später als geplant`
  }
  return `${s.deviationMinutes} Min. nach geplantem Beginn (Schicht läuft)`
}

export function TerminalEmployeePickModal({
  open,
  mode,
  employees,
  runningPresence,
  shifts,
  checkInSuggestions = [],
  checkInAllEmployees,
  checkInSuggestionsLoading = false,
  checkInSuggestionsError = null,
  checkInSubmitting = false,
  checkInSubmitError = null,
  onClearCheckInSubmitError,
  checkoutBusy = false,
  checkoutError = null,
  onClose,
  onConfirmCheckIn,
  onPickCheckOut,
}: Props) {
  const todayIso = toISODateLocal(new Date())
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setSelectedId(null)
    }
  }, [open, mode])

  const rowsAll = useMemo((): TabletCheckInAllEmployeeRow[] => {
    if (checkInAllEmployees && checkInAllEmployees.length > 0) return checkInAllEmployees
    return employees
      .filter((e) => e.terminalEnabled && e.timeTrackingEnabled)
      .map((e) => ({
        employeeId: e.id,
        employeeName: e.displayName,
        role: [e.role, e.employmentRole].filter(Boolean).join(' · '),
        isClockedIn: isClockedIn(runningPresence, e.id),
      }))
  }, [checkInAllEmployees, employees, runningPresence])

  const listAllFiltered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rowsAll
    return rowsAll.filter((r) => r.employeeName.toLowerCase().includes(t))
  }, [rowsAll, q])

  if (!open) return null

  if (mode === 'check-out') {
    if (runningPresence.length === 0) {
      return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto p-4">
          <button type="button" className="absolute inset-0 bg-black/85 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[var(--bg-card)] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-bold text-[var(--text-main)]">Schicht beenden</h2>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="mt-4 text-center text-lg text-[var(--text-muted)]">Aktuell ist niemand eingestempelt.</p>
            {checkoutError ? (
              <p className="mt-4 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-100">
                {checkoutError}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" type="button" onClick={onClose}>
                Schließen
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto p-4">
        <button type="button" className="absolute inset-0 bg-black/85 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
        <div className="relative w-full max-w-2xl rounded-2xl border border-orange-400/30 bg-[var(--bg-card)] p-5 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">Schicht beenden</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Wer geht? Nur eingestempelte Mitarbeitende.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
              <X className="h-6 w-6" />
            </button>
          </div>
          {checkoutError ? (
            <p className="mt-4 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{checkoutError}</p>
          ) : null}
          {checkoutBusy ? (
            <p className="mt-3 text-center text-sm text-[var(--text-muted)]">Checkliste wird geladen …</p>
          ) : null}
          <ul className="mt-5 grid max-h-[min(60vh,520px)] gap-3 overflow-y-auto sm:grid-cols-2">
            {runningPresence.map((row) => {
              const t = new Date(row.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={checkoutBusy}
                    onClick={() => onPickCheckOut(row)}
                    className="flex min-h-[88px] w-full flex-col items-start rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-left transition enabled:hover:border-cyan-400/40 enabled:hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="text-lg font-semibold text-[var(--text-main)]">{row.displayName}</span>
                    <span className="mt-1 text-sm text-cyan-200/90">Seit {t} Uhr eingestempelt</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-5 flex justify-end">
            <Button variant="ghost" type="button" onClick={onClose}>
              Abbrechen
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto p-4">
      <button type="button" className="absolute inset-0 bg-black/85 backdrop-blur-sm" aria-label="Schließen" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-[var(--bg-card)] p-5 shadow-xl sm:p-6">
        {checkInSubmitting ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/55 px-4 backdrop-blur-[2px]"
            aria-live="polite"
          >
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" aria-hidden />
            <p className="text-center text-base font-semibold text-cyan-100">Schicht wird gestartet …</p>
            <p className="text-center text-sm text-[var(--text-muted)]">Bitte warten</p>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">Schicht beginnen</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Vorschlag aus dem Schichtplan oder unten alle Mitarbeitenden.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-6 w-6" />
          </button>
        </div>

        {checkInSubmitError ? (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <p className="font-semibold">Schicht konnte nicht gestartet werden.</p>
            <p className="mt-1">{checkInSubmitError}</p>
            {onClearCheckInSubmitError ? (
              <button type="button" className="mt-2 text-xs font-medium text-rose-200 underline" onClick={onClearCheckInSubmitError}>
                Hinweis ausblenden
              </button>
            ) : null}
          </div>
        ) : null}

        <section className="mt-5 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.07] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-200/95">Vorgeschlagen laut Schichtplan</h3>
          {checkInSuggestionsLoading ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Schichtplan wird geprüft …</p>
          ) : null}
          {checkInSuggestionsError ? (
            <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {checkInSuggestionsError}
            </p>
          ) : null}
          {!checkInSuggestionsLoading && !checkInSuggestionsError && checkInSuggestions.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Aktuell ist laut Schichtplan niemand direkt zum Start vorgesehen.
            </p>
          ) : null}
          {!checkInSuggestionsLoading && checkInSuggestions.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {checkInSuggestions.map((s) => (
                <li key={s.shiftId}>
                  <div className="flex min-h-[168px] flex-col rounded-2xl border-2 border-cyan-400/75 bg-black/35 p-4 shadow-[0_0_22px_rgba(34,211,238,0.22)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-[var(--text-main)]">{s.employeeName}</span>
                      <span className="rounded-full border border-cyan-400/50 bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">
                        Jetzt geplant
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-cyan-100">
                      {s.plannedStart} – {s.plannedEnd} Uhr
                    </p>
                    <p className="mt-1 text-sm text-amber-200/95">{suggestionHint(s)}</p>
                    <div className="mt-auto pt-4">
                      <Button
                        type="button"
                        variant="primary"
                        className="w-full min-h-[48px] text-base font-semibold"
                        disabled={checkInSubmitting}
                        onClick={() => onConfirmCheckIn(s.employeeId, s.shiftId)}
                      >
                        Schicht beginnen
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">Alle Mitarbeiter anzeigen</h3>

        <label className="mt-3 block text-sm text-[var(--text-muted)]">
          Mitarbeiter suchen
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSelectedId(null)
              onClearCheckInSubmitError?.()
            }}
            placeholder="Name eingeben…"
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-lg text-[var(--text-main)]"
          />
        </label>
        <ul className="mt-4 grid max-h-[min(42vh,360px)] gap-3 overflow-y-auto sm:grid-cols-2">
          {listAllFiltered.map((row) => {
            const planned = todayShiftLine(shifts, row.employeeId, todayIso)
            const active = selectedId === row.employeeId
            const disabled = row.isClockedIn
            return (
              <li key={row.employeeId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return
                    setSelectedId(row.employeeId)
                    onClearCheckInSubmitError?.()
                  }}
                  className={`flex min-h-[100px] w-full flex-col items-start rounded-2xl border px-4 py-4 text-left transition sm:min-h-[112px] ${
                    disabled
                      ? 'cursor-not-allowed border-white/10 bg-black/20 opacity-45'
                      : active
                        ? 'border-cyan-400/60 bg-cyan-500/15 ring-2 ring-cyan-400/35'
                        : 'border-white/12 bg-black/30 hover:border-cyan-400/35'
                  }`}
                >
                  <span className="text-lg font-semibold text-[var(--text-main)]">{row.employeeName}</span>
                  {row.role ? <span className="mt-0.5 text-sm text-[var(--text-muted)]">{row.role}</span> : null}
                  <span className="mt-2 text-sm text-cyan-100/85">{planned}</span>
                  {row.isClockedIn ? (
                    <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-300">Bereits eingestempelt</span>
                  ) : (
                    <span className="mt-1 text-xs font-medium text-[var(--text-faint)]">Antippen zur Auswahl</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        {listAllFiltered.length === 0 ? <p className="mt-4 text-center text-[var(--text-muted)]">Keine Treffer.</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
          <Button variant="ghost" type="button" disabled={checkInSubmitting} onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            type="button"
            className="min-h-[52px] min-w-[200px] text-lg font-semibold"
            disabled={
              !selectedId ||
              checkInSubmitting ||
              rowsAll.some((r) => r.employeeId === selectedId && r.isClockedIn)
            }
            onClick={() => {
              if (!selectedId || checkInSubmitting) return
              onConfirmCheckIn(selectedId)
            }}
          >
            {checkInSubmitting ? 'Schicht wird gestartet…' : 'Schicht beginnen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
