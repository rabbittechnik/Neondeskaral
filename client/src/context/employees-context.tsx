import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Employee } from '../types/employee'
import { createEmployeeId } from '../lib/createEmployeeId'
import { apiGet, apiSend } from '../services/api'
import { useStation } from './station-context'
import { mergeEmployeeFromApi } from '../components/employees/employeeDefaults'

type EmployeesContextValue = {
  employees: Employee[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  /** Inaktive (deaktivierte) in derselben Liste wie aktive — ohne Soft-Deletes. */
  includeInactiveInList: boolean
  setIncludeInactiveInList: (v: boolean) => void
  /** Gelöschte in der Liste (nur mit Berechtigung `employees.viewDeleted`). */
  includeDeletedInList: boolean
  setIncludeDeletedInList: (v: boolean) => void
  getById: (id: string) => Employee | undefined
  addEmployee: (e: Employee) => Promise<void>
  updateEmployee: (e: Employee) => Promise<void>
  deactivateEmployee: (id: string) => Promise<void>
  deleteEmployee: (id: string, mode: 'soft' | 'hard') => Promise<{ mode: string; message?: string }>
  reactivateEmployee: (id: string) => Promise<void>
  restoreEmployee: (id: string) => Promise<void>
  regenerateEmployeeAccess: (id: string) => Promise<Employee>
  disableEmployeeAccess: (id: string) => Promise<void>
  enableEmployeeAccess: (id: string) => Promise<void>
  revokeAllEmployeeAppDevices: (id: string) => Promise<void>
}

const EmployeesContext = createContext<EmployeesContextValue | null>(null)

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const { stationId, hasPermission } = useStation()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeInactiveInList, setIncludeInactiveInList] = useState(false)
  const [includeDeletedInList, setIncludeDeletedInList] = useState(false)

  useEffect(() => {
    setEmployees([])
    setError(null)
  }, [stationId])

  const refetch = useCallback(async () => {
    if (!stationId) {
      setEmployees([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const canViewDeleted = hasPermission('employees.viewDeleted')
    const includeDeleted = includeDeletedInList && canViewDeleted
    const res = await apiGet<Employee[]>('/employees', {
      stationId,
      ...(includeInactiveInList ? { includeInactive: 'true' } : {}),
      ...(includeDeleted ? { includeDeleted: 'true' } : {}),
    })
    if (res.ok && Array.isArray(res.data)) {
      setEmployees(res.data.map((x) => mergeEmployeeFromApi(x as Partial<Employee> & { id: string })))
    } else {
      setError(res.ok === false ? res.error : 'Mitarbeiter konnten nicht geladen werden.')
      setEmployees([])
    }
    setLoading(false)
  }, [stationId, hasPermission, includeInactiveInList, includeDeletedInList])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const getById = useCallback(
    (id: string) => employees.find((e) => e.id === id),
    [employees],
  )

  const addEmployee = useCallback(
    async (e: Employee) => {
      if (!stationId) throw new Error('Keine Station gewählt')
      const id = e.id?.trim() ? e.id : createEmployeeId()
      const res = await apiSend<Employee>('POST', '/employees', { ...e, id }, { stationId })
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch, stationId],
  )

  const updateEmployee = useCallback(async (e: Employee) => {
    const { employeeAccessToken: _omitAccessToken, ...payload } = e
    void _omitAccessToken
    const res = await apiSend<Employee>('PUT', `/employees/${encodeURIComponent(e.id)}`, payload)
    if (!res.ok) throw new Error(res.error)
    await refetch()
  }, [refetch])

  const deactivateEmployee = useCallback(async (id: string) => {
    const res = await apiSend('DELETE', `/employees/${encodeURIComponent(id)}`, undefined, { mode: 'soft' })
    if (!res.ok) throw new Error(res.error)
    await refetch()
  }, [refetch])

  const deleteEmployee = useCallback(
    async (id: string, mode: 'soft' | 'hard') => {
      const res = await apiSend<{ ok?: boolean; deleted?: boolean; mode?: string; message?: string }>(
        'DELETE',
        `/employees/${encodeURIComponent(id)}`,
        undefined,
        { mode },
      )
      if (!res.ok) throw new Error(res.error)
      await refetch()
      const d = (res as { data?: { ok?: boolean; mode?: string; message?: string } }).data
      return { mode: d?.mode ?? mode, message: d?.message }
    },
    [refetch],
  )

  const reactivateEmployee = useCallback(
    async (id: string) => {
      const got = await apiGet<Employee>(`/employees/${encodeURIComponent(id)}`)
      if (!got.ok || !got.data) throw new Error(got.ok === false ? got.error : 'Mitarbeiter nicht gefunden')
      const { employeeAccessToken: _omit, ...rest } = got.data
      void _omit
      const res = await apiSend<Employee>('PUT', `/employees/${encodeURIComponent(id)}`, {
        ...rest,
        status: 'aktiv',
      })
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const restoreEmployee = useCallback(
    async (id: string) => {
      const res = await apiSend<Employee>('POST', `/employees/${encodeURIComponent(id)}/restore`, {})
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const regenerateEmployeeAccess = useCallback(
    async (id: string) => {
      const res = await apiSend<Employee>('POST', `/employees/${encodeURIComponent(id)}/regenerate-access-token`, {})
      if (!res.ok || !res.data) throw new Error(res.ok === false ? res.error : 'Fehler')
      await refetch()
      return res.data
    },
    [refetch],
  )

  const disableEmployeeAccess = useCallback(
    async (id: string) => {
      const res = await apiSend<Employee>('POST', `/employees/${encodeURIComponent(id)}/disable-access`, {})
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const enableEmployeeAccess = useCallback(
    async (id: string) => {
      const res = await apiSend<Employee>('POST', `/employees/${encodeURIComponent(id)}/enable-access`, {})
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const revokeAllEmployeeAppDevices = useCallback(
    async (id: string) => {
      const res = await apiSend<{ ok?: boolean }>(
        'POST',
        `/employees/${encodeURIComponent(id)}/revoke-all-devices`,
        {},
      )
      if (!res.ok) throw new Error(res.ok === false ? res.error : 'Fehler')
      await refetch()
    },
    [refetch],
  )

  const value = useMemo(
    () => ({
      employees,
      loading,
      error,
      refetch,
      includeInactiveInList,
      setIncludeInactiveInList,
      includeDeletedInList,
      setIncludeDeletedInList,
      getById,
      addEmployee,
      updateEmployee,
      deactivateEmployee,
      deleteEmployee,
      reactivateEmployee,
      restoreEmployee,
      regenerateEmployeeAccess,
      disableEmployeeAccess,
      enableEmployeeAccess,
      revokeAllEmployeeAppDevices,
    }),
    [
      employees,
      loading,
      error,
      refetch,
      includeInactiveInList,
      setIncludeInactiveInList,
      includeDeletedInList,
      setIncludeDeletedInList,
      getById,
      addEmployee,
      updateEmployee,
      deactivateEmployee,
      deleteEmployee,
      reactivateEmployee,
      restoreEmployee,
      regenerateEmployeeAccess,
      disableEmployeeAccess,
      enableEmployeeAccess,
      revokeAllEmployeeAppDevices,
    ],
  )

  return (
    <EmployeesContext.Provider value={value}>{children}</EmployeesContext.Provider>
  )
}

export function useEmployees() {
  const ctx = useContext(EmployeesContext)
  if (!ctx) {
    throw new Error('useEmployees must be used within EmployeesProvider')
  }
  return ctx
}
