import { useMemo, useState } from 'react'
import { AlertTriangle, Check, FileText, X } from 'lucide-react'
import type { Absence } from '../../types/absence'
import type { Employee } from '../../types/employee'
import { useAbsences } from '../../context/absences-context'
import { checkAbsenceConflicts } from '../../utils/absenceConflicts'
import { useScheduleShifts } from '../../context/schedule-shifts-context'
import { countAbsenceDays } from '../../utils/absenceQueries'
import { AbsenceTypeBadge } from './AbsenceTypeBadge'
import { AbsenceStatusBadge } from './AbsenceStatusBadge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type Props = {
  employees: Employee[]
  onDetails: (a: Absence) => void
  federalState: import('../../data/germanHolidays').GermanState
}

export function AbsenceRequestsView({ employees, onDetails, federalState }: Props) {
  const { absences, approveAbsence, rejectAbsence, vacationBlocks } = useAbsences()
  const { shifts } = useScheduleShifts()
  const [rejecting, setRejecting] = useState<Absence | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const pending = useMemo(
    () => absences.filter((a) => a.status === 'beantragt'),
    [absences],
  )

  const warningsFor = (a: Absence) =>
    checkAbsenceConflicts(
      { employeeId: a.employeeId, startDate: a.startDate, endDate: a.endDate, type: a.type },
      {
        absences,
        vacationBlocks,
        shifts,
        employees,
        federalState,
        excludeAbsenceId: a.id,
      },
    )

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-[var(--text-faint)]">
          Keine offenen Anträge.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pending.map((a) => {
            const emp = employees.find((e) => e.id === a.employeeId)
            const days = countAbsenceDays(a.startDate, a.endDate, a.halfDay)
            const ws = warningsFor(a)
            return (
              <Card key={a.id} padding="md" className="border-cyan-500/15">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">
                      {emp?.displayName ?? a.employeeId}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <AbsenceTypeBadge type={a.type} />
                      <AbsenceStatusBadge status={a.status} />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {a.startDate} – {a.endDate} · {days} Tag(e)
                </p>
                {a.comment ? (
                  <p className="mt-2 text-xs text-[var(--text-faint)]">„{a.comment}“</p>
                ) : null}
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  Beantragt: {a.requestedAt.slice(0, 16).replace('T', ' ')}
                </p>
                {ws.length > 0 ? (
                  <div className="mt-3 flex gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <ul className="list-inside list-disc space-y-0.5">
                      {ws.map((w) => (
                        <li key={w.id}>{w.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary" type="button" onClick={() => void approveAbsence(a.id)} leftIcon={<Check className="h-4 w-4" />}>
                    Genehmigen
                  </Button>
                  <Button variant="ghost" type="button" className="text-red-300" onClick={() => { setRejecting(a); setRejectReason('') }} leftIcon={<X className="h-4 w-4" />}>
                    Ablehnen
                  </Button>
                  <Button variant="outline" type="button" onClick={() => onDetails(a)} leftIcon={<FileText className="h-4 w-4" />}>
                    Details
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {rejecting ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden onClick={() => setRejecting(null)} />
          <div className="relative z-10 w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Antrag ablehnen</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Optional: Ablehnungsgrund</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setRejecting(null)}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  void rejectAbsence(rejecting.id, rejectReason.trim() || undefined)
                  setRejecting(null)
                }}
              >
                Ablehnen
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
