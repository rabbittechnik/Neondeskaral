import { useCallback, useMemo, useState } from 'react'
import { FileDown, Plus, Printer } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { Absence, VacationBlock } from '../../types/absence'
import { useAbsences } from '../../context/absences-context'
import { useEmployees } from '../../context/employees-context'
import { STATION_FEDERAL_STATE } from '../../data/station'
import { ABSENCE_STATUS_LABELS, ABSENCE_TYPE_LABELS } from '../../components/absences/absenceLabels'
import { AbsenceCalendarView } from '../../components/absences/AbsenceCalendarView'
import { AbsenceListView } from '../../components/absences/AbsenceListView'
import { AbsenceModal } from '../../components/absences/AbsenceModal'
import { AbsenceRequestsView } from '../../components/absences/AbsenceRequestsView'
import type { AbsencesViewMode } from '../../components/absences/AbsenceViewTabs'
import { AbsenceViewTabs } from '../../components/absences/AbsenceViewTabs'
import { VacationBlocksView } from '../../components/absences/VacationBlocksView'
import { VacationBlockModal } from '../../components/absences/VacationBlockModal'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'

const VIEW_VALUES: AbsencesViewMode[] = ['calendar', 'list', 'requests', 'vacation-blocks']

function parseView(raw: string | null): AbsencesViewMode {
  if (raw && VIEW_VALUES.includes(raw as AbsencesViewMode)) return raw as AbsencesViewMode
  return 'calendar'
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function AbsencesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = useMemo(() => parseView(searchParams.get('view')), [searchParams])
  const setView = useCallback(
    (v: AbsencesViewMode) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v === 'calendar') next.delete('view')
          else next.set('view', v)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const { employees } = useEmployees()
  const { absences, addAbsence, setAbsence, addVacationBlock, setVacationBlock } = useAbsences()

  const [absenceModal, setAbsenceModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    absence: Absence | null
  }>({ open: false, mode: 'create', absence: null })

  const [vbModal, setVbModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    block: VacationBlock | null
  }>({ open: false, mode: 'create', block: null })

  const openNewAbsence = () => setAbsenceModal({ open: true, mode: 'create', absence: null })
  const openEditAbsence = (a: Absence) => setAbsenceModal({ open: true, mode: 'edit', absence: a })
  const openNewVb = () => setVbModal({ open: true, mode: 'create', block: null })
  const openEditVb = (b: VacationBlock) => setVbModal({ open: true, mode: 'edit', block: b })

  const exportCsv = () => {
    const header = [
      'Mitarbeiter-ID',
      'Mitarbeiter',
      'Typ',
      'Start',
      'Ende',
      'Halbtag',
      'Status',
      'Kommentar',
      'Beantragt',
      'Genehmigt von',
    ]
    const lines = [header.join(',')]
    for (const a of absences) {
      const emp = employees.find((e) => e.id === a.employeeId)
      lines.push(
        [
          a.employeeId,
          emp?.displayName ?? '',
          ABSENCE_TYPE_LABELS[a.type],
          a.startDate,
          a.endDate,
          a.halfDay ? 'ja' : 'nein',
          ABSENCE_STATUS_LABELS[a.status],
          a.comment ?? '',
          a.requestedAt,
          a.approvedBy ?? '',
        ]
          .map((c) => csvEscape(String(c)))
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abwesenheiten-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printStub = () => {
    window.alert(
      'Druck / PDF: später mit Backend oder Browser-PDF. Vorschau: Strg+P (Seite wie angezeigt).',
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abwesenheiten"
        description="Urlaub, Krankheit, freie Tage und Abwesenheitsanträge deiner Station verwalten."
        actions={
          <>
            <Button variant="primary" type="button" onClick={openNewAbsence} leftIcon={<Plus className="h-4 w-4" />}>
              Neue Abwesenheit
            </Button>
            <Button variant="outline" type="button" onClick={openNewVb} leftIcon={<Plus className="h-4 w-4" />}>
              Urlaubssperre
            </Button>
            <Button variant="ghost" type="button" onClick={exportCsv} leftIcon={<FileDown className="h-4 w-4" />}>
              CSV Export
            </Button>
            <Button variant="ghost" type="button" onClick={printStub} leftIcon={<Printer className="h-4 w-4" />}>
              Druck / PDF
            </Button>
          </>
        }
      />

      <AbsenceViewTabs active={view} onChange={setView} />

      {view === 'calendar' ? (
        <AbsenceCalendarView absences={absences} employees={employees} federalState={STATION_FEDERAL_STATE} />
      ) : null}
      {view === 'list' ? (
        <AbsenceListView employees={employees} onEdit={openEditAbsence} onView={openEditAbsence} />
      ) : null}
      {view === 'requests' ? (
        <AbsenceRequestsView
          employees={employees}
          federalState={STATION_FEDERAL_STATE}
          onDetails={openEditAbsence}
        />
      ) : null}
      {view === 'vacation-blocks' ? <VacationBlocksView onAdd={openNewVb} onEdit={openEditVb} /> : null}

      <AbsenceModal
        open={absenceModal.open}
        mode={absenceModal.mode}
        absence={absenceModal.absence}
        onClose={() => setAbsenceModal((s) => ({ ...s, open: false }))}
        onSave={(a) => {
          if (absenceModal.mode === 'create') addAbsence(a)
          else setAbsence(a)
        }}
      />

      <VacationBlockModal
        open={vbModal.open}
        mode={vbModal.mode}
        block={vbModal.block}
        onClose={() => setVbModal((s) => ({ ...s, open: false }))}
        onSave={(b) => {
          if (vbModal.mode === 'create') addVacationBlock(b)
          else setVacationBlock(b)
        }}
      />
    </div>
  )
}
