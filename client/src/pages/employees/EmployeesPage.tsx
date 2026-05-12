import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { EmployeeCard } from '../../components/employees/EmployeeCard'
import { EmployeeModal } from '../../components/employees/EmployeeModal'
import { EmployeeTable } from '../../components/employees/EmployeeTable'
import { EmployeesToolbar, type ViewMode } from '../../components/employees/EmployeesToolbar'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { useEmployees } from '../../context/employees-context'
import type { Employee, EmployeeHRStatus, EmploymentType } from '../../types/employee'

function filterEmployees(
  list: Employee[],
  q: string,
  employment: EmploymentType | 'all',
  status: EmployeeHRStatus | 'all',
  workAreaId: string | 'all',
): Employee[] {
  const needle = q.trim().toLowerCase()
  return list.filter((e) => {
    if (employment !== 'all' && e.employmentType !== employment) return false
    if (status !== 'all' && e.status !== status) return false
    if (workAreaId !== 'all' && !e.workAreaIds.includes(workAreaId)) return false
    if (needle) {
      const blob =
        `${e.displayName} ${e.firstName} ${e.lastName} ${e.email} ${e.role}`.toLowerCase()
      if (!blob.includes(needle)) return false
    }
    return true
  })
}

export function EmployeesPage() {
  const { employees, addEmployee, updateEmployee, deactivateEmployee, reactivateEmployee } =
    useEmployees()

  const [search, setSearch] = useState('')
  const [employment, setEmployment] = useState<EmploymentType | 'all'>('all')
  const [status, setStatus] = useState<EmployeeHRStatus | 'all'>('all')
  const [workAreaId, setWorkAreaId] = useState<string | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<Employee | null>(null)

  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null)

  const filtered = useMemo(
    () => filterEmployees(employees, search, employment, status, workAreaId),
    [employees, search, employment, status, workAreaId],
  )

  const openCreate = () => {
    setModalMode('create')
    setEditTarget(null)
    setModalOpen(true)
  }

  const openEdit = (e: Employee) => {
    setModalMode('edit')
    setEditTarget(e)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Mitarbeiter"
        description="Verwalte Stammdaten, Rollen, Arbeitsbereiche und Schichtplan-Informationen deiner Station."
        actions={
          <Button variant="primary" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Neuer Mitarbeiter
          </Button>
        }
      />

      <EmployeesToolbar
        search={search}
        onSearch={setSearch}
        employment={employment}
        onEmployment={setEmployment}
        status={status}
        onStatus={setStatus}
        workAreaId={workAreaId}
        onWorkArea={setWorkAreaId}
        viewMode={viewMode}
        onViewMode={setViewMode}
        onExport={() => {
          alert('Export folgt mit Backend (CSV/PDF).')
        }}
      />

      {viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <EmployeeCard
              key={e.id}
              employee={e}
              onEdit={() => openEdit(e)}
              onDeactivate={() => setConfirmDeactivateId(e.id)}
              onReactivate={
                e.status === 'inaktiv' ? () => reactivateEmployee(e.id) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmployeeTable
          employees={filtered}
          onEdit={openEdit}
          onDeactivate={(e) => setConfirmDeactivateId(e.id)}
          onReactivate={(e) => reactivateEmployee(e.id)}
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-[var(--text-muted)]">
          Keine Treffer. Filter oder Suche anpassen.
        </p>
      ) : null}

      <EmployeeModal
        open={modalOpen}
        mode={modalMode}
        employee={editTarget}
        onClose={() => setModalOpen(false)}
        onSaveCreate={addEmployee}
        onSaveEdit={updateEmployee}
      />

      <ConfirmDialog
        open={confirmDeactivateId !== null}
        title="Mitarbeiter deaktivieren"
        message="Möchtest du diesen Mitarbeiter wirklich deaktivieren?"
        confirmLabel="Deaktivieren"
        cancelLabel="Abbrechen"
        variant="danger"
        onCancel={() => setConfirmDeactivateId(null)}
        onConfirm={() => {
          if (confirmDeactivateId) deactivateEmployee(confirmDeactivateId)
          setConfirmDeactivateId(null)
        }}
      />
    </div>
  )
}
