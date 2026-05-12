import { useMemo, useState } from 'react'
import { Eye, Pencil, Check, X, Trash2 } from 'lucide-react'
import type { Absence } from '../../types/absence'
import type { Employee } from '../../types/employee'
import { useAbsences } from '../../context/absences-context'
import { countAbsenceDays } from '../../utils/absenceQueries'
import { AbsenceFilters, filterAbsencesList, useListFiltersState } from './AbsenceFilters'
import { AbsenceTypeBadge } from './AbsenceTypeBadge'
import { AbsenceStatusBadge } from './AbsenceStatusBadge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

type Props = {
  employees: Employee[]
  onEdit: (a: Absence) => void
  onView: (a: Absence) => void
}

function formatDeRange(start: string, end: string): string {
  const f = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }
  return start === end ? f(start) : `${f(start)} – ${f(end)}`
}

export function AbsenceListView({ employees, onEdit, onView }: Props) {
  const { absences, approveAbsence, rejectAbsence, removeAbsence } = useAbsences()
  const [filters, setFilters] = useListFiltersState()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const rows = useMemo(
    () => filterAbsencesList(absences, employees, filters),
    [absences, employees, filters],
  )

  const emp = (id: string) => employees.find((e) => e.id === id)

  return (
    <div className="space-y-4">
      <AbsenceFilters value={filters} onChange={setFilters} />
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-3">Mitarbeiter</th>
              <th className="px-3 py-3">Typ</th>
              <th className="px-3 py-3">Zeitraum</th>
              <th className="px-3 py-3">Tage</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Beantragt am</th>
              <th className="px-3 py-3">Genehmigt von</th>
              <th className="px-3 py-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const e = emp(a.employeeId)
              const days = countAbsenceDays(a.startDate, a.endDate, a.halfDay)
              return (
                <tr key={a.id} className="border-b border-[var(--border-subtle)]/60 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-medium text-[var(--text-main)]">
                    {e?.displayName ?? a.employeeId}
                  </td>
                  <td className="px-3 py-2">
                    <AbsenceTypeBadge type={a.type} />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">
                    {formatDeRange(a.startDate, a.endDate)}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{days}</td>
                  <td className="px-3 py-2">
                    <AbsenceStatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-faint)]">
                    {a.requestedAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{a.approvedBy ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onView(a)} leftIcon={<Eye className="h-3.5 w-3.5" />}>
                        Anzeigen
                      </Button>
                      <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onEdit(a)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                        Bearbeiten
                      </Button>
                      {a.status === 'beantragt' ? (
                        <>
                          <Button
                            variant="outline"
                            className="!px-2 !py-1 text-xs"
                            onClick={() => approveAbsence(a.id)}
                            leftIcon={<Check className="h-3.5 w-3.5" />}
                          >
                            Genehmigen
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs text-red-300"
                            onClick={() => rejectAbsence(a.id)}
                            leftIcon={<X className="h-3.5 w-3.5" />}
                          >
                            Ablehnen
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs text-red-300"
                        onClick={() => setDeleteId(a.id)}
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        Löschen
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-faint)]">Keine Einträge für die Filter.</p>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Abwesenheit löschen?"
        message="Der Eintrag wird dauerhaft aus der Liste entfernt."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) removeAbsence(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
