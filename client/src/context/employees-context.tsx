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
import { createEmployeeId } from '../data/mockEmployees'
import { apiGet, apiSend } from '../services/api'
import { STATION } from '../data/station'

type EmployeesContextValue = {
  employees: Employee[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  getById: (id: string) => Employee | undefined
  addEmployee: (e: Employee) => Promise<void>
  updateEmployee: (e: Employee) => Promise<void>
  deactivateEmployee: (id: string) => Promise<void>
  reactivateEmployee: (id: string) => Promise<void>
  regenerateEmployeeAccess: (id: string) => Promise<Employee>
  disableEmployeeAccess: (id: string) => Promise<void>
  enableEmployeeAccess: (id: string) => Promise<void>
}

const EmployeesContext = createContext<EmployeesContextValue | null>(null)

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await apiGet<Employee[]>('/employees', { stationId: STATION.id, includeInactive: 'true' })
    if (res.ok && Array.isArray(res.data)) {
      setEmployees(res.data)
    } else {
      setError(res.ok === false ? res.error : 'Mitarbeiter konnten nicht geladen werden.')
      setEmployees([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const getById = useCallback(
    (id: string) => employees.find((e) => e.id === id),
    [employees],
  )

  const addEmployee = useCallback(async (e: Employee) => {
    const id = e.id?.trim() ? e.id : createEmployeeId()
    const res = await apiSend<Employee>('POST', '/employees', { ...e, id }, { stationId: STATION.id })
    if (!res.ok) throw new Error(res.error)
    await refetch()
  }, [refetch])

  const updateEmployee = useCallback(async (e: Employee) => {
    const res = await apiSend<Employee>('PUT', `/employees/${encodeURIComponent(e.id)}`, e)
    if (!res.ok) throw new Error(res.error)
    await refetch()
  }, [refetch])

  const deactivateEmployee = useCallback(async (id: string) => {
    const res = await apiSend('DELETE', `/employees/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error(res.error)
    await refetch()
  }, [refetch])

  const reactivateEmployee = useCallback(
    async (id: string) => {
      const got = await apiGet<Employee>(`/employees/${encodeURIComponent(id)}`)
      if (!got.ok || !got.data) throw new Error(got.ok === false ? got.error : 'Mitarbeiter nicht gefunden')
      const res = await apiSend<Employee>('PUT', `/employees/${encodeURIComponent(id)}`, {
        ...got.data,
        status: 'aktiv',
      })
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
      if (!res.ok) throw new Error(res.ok === false ? res.error : 'Fehler')
      await refetch()
    },
    [refetch],
  )

  const enableEmployeeAccess = useCallback(
    async (id: string) => {
      const res = await apiSend<Employee>('POST', `/employees/${encodeURIComponent(id)}/enable-access`, {})
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
      getById,
      addEmployee,
      updateEmployee,
      deactivateEmployee,
      reactivateEmployee,
      regenerateEmployeeAccess,
      disableEmployeeAccess,
      enableEmployeeAccess,
    }),
    [
      employees,
      loading,
      error,
      refetch,
      getById,
      addEmployee,
      updateEmployee,
      deactivateEmployee,
      reactivateEmployee,
      regenerateEmployeeAccess,
      disableEmployeeAccess,
      enableEmployeeAccess,
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
