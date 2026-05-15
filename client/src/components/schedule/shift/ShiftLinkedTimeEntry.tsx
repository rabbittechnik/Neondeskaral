import { Link } from 'react-router-dom'
import type { ScheduleShift } from '../../../data/mockSchedule'
import type { TimeEntry } from '../../../types/timeTracking'
import { Button } from '../../ui/Button'
import { calculateWorkedMinutes, formatWorkedDuration } from '../../../utils/timeTrackingUtils'

type Props = {
  shift: ScheduleShift
  timeEntries: TimeEntry[]
  canCorrect: boolean
  onOpenTimeEntry?: (timeEntryId: string) => void
}

function sourceLabel(source: string | undefined): string {
  if (source === 'tablet' || source === 'cash_register_card_terminal') return 'Stationstablet'
  if (source === 'employee_mobile_app' || source === 'employee_app') return 'Mitarbeiter-App'
  if (source === 'manual') return 'Manuell'
  return source ?? '—'
}

function approvalLabel(s: string | undefined): string {
  if (s === 'approved') return 'freigegeben'
  if (s === 'rejected') return 'abgelehnt'
  if (s === 'correction_required') return 'Korrektur nötig'
  if (s === 'pending') return 'offen'
  return s ?? '—'
}

function findLinkedEntry(shift: ScheduleShift, entries: TimeEntry[]): TimeEntry | null {
  if (!shift.employeeId) return null
  const byShift = entries.filter((e) => e.shiftId === shift.id)
  if (byShift.length) {
    return byShift.sort((a, b) => b.startAt.localeCompare(a.startAt))[0] ?? null
  }
  const day = entries.filter(
    (e) => e.employeeId === shift.employeeId && e.startAt.slice(0, 10) === shift.date && e.status === 'completed',
  )
  return day.sort((a, b) => b.startAt.localeCompare(a.startAt))[0] ?? null
}

function hmFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
}

export function ShiftLinkedTimeEntry({ shift, timeEntries, canCorrect, onOpenTimeEntry }: Props) {
  const entry = findLinkedEntry(shift, timeEntries)
  const planLabel =
    shift.startTime && shift.endTime ? `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}` : '—'

  if (!entry || !entry.endAt) {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Zeiterfassung zu dieser Schicht
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Keine Zeitbuchung vorhanden</p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Geplant: {planLabel}</p>
      </div>
    )
  }

  const stampedStart = hmFromIso(entry.startAt)
  const stampedEnd = hmFromIso(entry.endAt)
  const stampedGross = calculateWorkedMinutes(entry.startAt, entry.endAt)
  const stampedMin = Math.max(0, stampedGross - Math.max(0, entry.breakMinutes ?? 0))
  const planGross =
    shift.startTime && shift.endTime
      ? calculateWorkedMinutes(`${shift.date}T${shift.startTime}:00`, `${shift.date}T${shift.endTime}:00`)
      : 0
  const planMin = Math.max(0, planGross - Math.max(0, shift.breakMinutes ?? 0))
  const diffMin = stampedMin - planMin
  const diffLabel =
    diffMin === 0
      ? 'keine Abweichung'
      : `${diffMin > 0 ? '+' : ''}${formatWorkedDuration(Math.abs(diffMin))}`

  const effStart = entry.effectiveStartAt ?? entry.startAt
  const effEnd = entry.effectiveEndAt ?? entry.endAt
  const hasCorrection =
    entry.latestCorrectionKind === 'manual' ||
    effStart !== entry.startAt ||
    effEnd !== entry.endAt ||
    (entry.breakMinutes ?? 0) !== (entry.effectiveBreakMinutes ?? entry.breakMinutes ?? 0)

  return (
    <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        Zeiterfassung zu dieser Schicht
      </p>
      <dl className="mt-2 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--text-faint)]">Geplant</dt>
          <dd className="tabular-nums text-[var(--text-main)]">{planLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--text-faint)]">Gestempelt</dt>
          <dd className="tabular-nums text-[var(--text-main)]">
            {stampedStart}–{stampedEnd}
          </dd>
        </div>
        {hasCorrection ? (
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--text-faint)]">Abrechnung (korrigiert)</dt>
            <dd className="tabular-nums text-violet-100">
              {hmFromIso(effStart)}–{hmFromIso(effEnd)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--text-faint)]">Differenz</dt>
          <dd className="tabular-nums text-[var(--text-main)]">{diffLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--text-faint)]">Status</dt>
          <dd className="text-[var(--text-main)]">
            {hasCorrection ? 'korrigiert / ' : ''}
            {approvalLabel(entry.approvalStatus)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--text-faint)]">Quelle</dt>
          <dd className="text-[var(--text-main)]">{sourceLabel(entry.source)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {onOpenTimeEntry ? (
          <Button type="button" variant="outline" className="text-xs" onClick={() => onOpenTimeEntry(entry.id)}>
            Zeitbuchung öffnen
          </Button>
        ) : (
          <Link
            to={`/time-approvals?entry=${encodeURIComponent(entry.id)}`}
            className="inline-flex items-center rounded-lg border border-white/15 px-3 py-1.5 text-xs text-[var(--text-main)] hover:bg-white/5"
          >
            Zur Zeitfreigabe
          </Link>
        )}
        {canCorrect ? (
          <Link
            to={`/time-approvals?entry=${encodeURIComponent(entry.id)}&correct=1`}
            className="inline-flex items-center rounded-lg border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-500/20"
          >
            Zeit korrigieren
          </Link>
        ) : null}
      </div>
    </div>
  )
}
