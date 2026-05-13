import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import type { ClockCardEmployee } from '../../utils/timeTrackingUtils'
import type { TabletRunningRow } from '../../context/tablet-terminal-context'
import type { ScheduleShift } from '../../data/mockSchedule'
import { toISODateLocal } from '../../utils/taskUtils'

type Mode = 'check-in' | 'check-out'

type Props = {
  open: boolean
  mode: Mode
  employees: ClockCardEmployee[]
  runningPresence: TabletRunningRow[]
  shifts: ScheduleShift[]
  /** Beim Schichtende: Server-Antwort lädt (Checkliste vorbereiten). */
  checkoutBusy?: boolean
  /** Beim Schichtende: Fehler vom check-out-start. */
  checkoutError?: string | null
  onClose: () => void
  onConfirmCheckIn: (employeeId: string) => void
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

export function TerminalEmployeePickModal({
  open,
  mode,
  employees,
  runningPresence,
  shifts,
  checkoutBusy = false,
  checkoutError = null,
  onClose,
  onConfirmCheckIn,
  onPickCheckOut,
}: Props) {
  const todayIso = toISODateLocal(new Date())
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const listIn = useMemo(() => {
    const base = employees.filter((e) => e.terminalEnabled && e.timeTrackingEnabled)
    const t = q.trim().toLowerCase()
    if (!t) return base
    return base.filter((e) => e.displayName.toLowerCase().includes(t))
  }, [employees, q])

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
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-main)] sm:text-2xl">Schicht beginnen</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Tippe auf deinen Namen, dann auf „Schicht beginnen“.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10" aria-label="Schließen">
            <X className="h-6 w-6" />
          </button>
        </div>
        <label className="mt-4 block text-sm text-[var(--text-muted)]">
          Mitarbeiter suchen
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSelectedId(null)
            }}
            placeholder="Name eingeben…"
            className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-lg text-[var(--text-main)]"
          />
        </label>
        <ul className="mt-4 grid max-h-[min(50vh,440px)] gap-3 overflow-y-auto sm:grid-cols-2">
          {listIn.map((e) => {
            const sub = [e.role, e.employmentRole].filter(Boolean).join(' · ')
            const planned = todayShiftLine(shifts, e.id, todayIso)
            const stamped = isClockedIn(runningPresence, e.id)
            const active = selectedId === e.id
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={`flex min-h-[100px] w-full flex-col items-start rounded-2xl border px-4 py-4 text-left transition sm:min-h-[112px] ${
                    active
                      ? 'border-cyan-400/60 bg-cyan-500/15 ring-2 ring-cyan-400/35'
                      : 'border-white/12 bg-black/30 hover:border-cyan-400/35'
                  }`}
                >
                  <span className="text-lg font-semibold text-[var(--text-main)]">{e.displayName}</span>
                  {sub ? <span className="mt-0.5 text-sm text-[var(--text-muted)]">{sub}</span> : null}
                  <span className="mt-2 text-sm text-cyan-100/85">{planned}</span>
                  {stamped ? (
                    <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-300">Aktuell eingestempelt</span>
                  ) : (
                    <span className="mt-1 text-xs font-medium text-[var(--text-faint)]">Geplant / nicht eingestempelt</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        {listIn.length === 0 ? <p className="mt-4 text-center text-[var(--text-muted)]">Keine Treffer.</p> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            type="button"
            className="min-h-[52px] min-w-[200px] text-lg font-semibold"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) onConfirmCheckIn(selectedId)
            }}
          >
            Schicht beginnen
          </Button>
        </div>
      </div>
    </div>
  )
}
