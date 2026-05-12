import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { EmployeeCard } from '../../components/employees/EmployeeCard'
import { EmployeeDeleteDialog } from '../../components/employees/EmployeeDeleteDialog'
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
  const {
    employees,
    addEmployee,
    updateEmployee,
    deactivateEmployee,
    deleteEmployee,
    reactivateEmployee,
    loading,
    error,
  } = useEmployees()

  const [search, setSearch] = useState('')
  const [employment, setEmployment] = useState<EmploymentType | 'all'>('all')
  const [status, setStatus] = useState<EmployeeHRStatus | 'all'>('all')
  const [workAreaId, setWorkAreaId] = useState<string | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<Employee | null>(null)

  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

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

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Mitarbeiter werden geladen…</p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
          {error}
        </p>
      ) : null}

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
                e.status === 'inaktiv' ? () => void reactivateEmployee(e.id) : undefined
              }
              onRequestDelete={() => setDeleteTarget(e)}
            />
          ))}
        </div>
      ) : (
        <EmployeeTable
          employees={filtered}
          onEdit={openEdit}
          onDeactivate={(e) => setConfirmDeactivateId(e.id)}
          onReactivate={(e) => void reactivateEmployee(e.id)}
          onRequestDelete={(e) => setDeleteTarget(e)}
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
          if (confirmDeactivateId) void deactivateEmployee(confirmDeactivateId)
          setConfirmDeactivateId(null)
        }}
      />

      <EmployeeDeleteDialog
        open={deleteTarget !== null}
        employee={deleteTarget}
        busy={deleteBusy}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null)
        }}
        onDeactivateInstead={async () => {
          if (!deleteTarget) return
          setDeleteBusy(true)
          try {
            await deactivateEmployee(deleteTarget.id)
            setDeleteTarget(null)
          } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Fehler')
          }
          setDeleteBusy(false)
        }}
        onHardDelete={async () => {
          if (!deleteTarget) return
          setDeleteBusy(true)
          try {
            const r = await deleteEmployee(deleteTarget.id, 'hard')
            if (r.message) window.alert(r.message)
            setDeleteTarget(null)
          } catch (err) {
            window.alert(err instanceof Error ? err.message : 'Fehler')
          }
          setDeleteBusy(false)
        }}
      />
    </div>
  )
}
