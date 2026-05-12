import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Employee } from '../types/employee'
import { cloneSeedEmployees, createEmployeeId } from '../data/mockEmployees'

type EmployeesContextValue = {
  employees: Employee[]
  getById: (id: string) => Employee | undefined
  addEmployee: (e: Employee) => void
  updateEmployee: (e: Employee) => void
  deactivateEmployee: (id: string) => void
  reactivateEmployee: (id: string) => void
}

const EmployeesContext = createContext<EmployeesContextValue | null>(null)

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(() => cloneSeedEmployees())

  const getById = useCallback(
    (id: string) => employees.find((e) => e.id === id),
    [employees],
  )

  const addEmployee = useCallback((e: Employee) => {
    const id = e.id?.trim() ? e.id : createEmployeeId()
    setEmployees((prev) => [...prev, { ...e, id }])
  }, [])

  const updateEmployee = useCallback((e: Employee) => {
    setEmployees((prev) => prev.map((x) => (x.id === e.id ? e : x)))
  }, [])

  const deactivateEmployee = useCallback((id: string) => {
    setEmployees((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: 'inaktiv' } : x)),
    )
  }, [])

  const reactivateEmployee = useCallback((id: string) => {
    setEmployees((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: 'aktiv' } : x)),
    )
  }, [])

  const value = useMemo(
    () => ({
      employees,
      getById,
      addEmployee,
      updateEmployee,
      deactivateEmployee,
      reactivateEmployee,
    }),
    [
      employees,
      getById,
      addEmployee,
      updateEmployee,
      deactivateEmployee,
      reactivateEmployee,
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
