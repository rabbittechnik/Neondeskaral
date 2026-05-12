import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Absence, VacationBlock } from '../types/absence'
import {
  cloneSeedAbsences,
  cloneSeedVacationBlocks,
  createAbsenceId,
  createVacationBlockId,
} from '../data/mockAbsences'

type AbsencesContextValue = {
  absences: Absence[]
  vacationBlocks: VacationBlock[]
  setAbsence: (a: Absence) => void
  addAbsence: (a: Absence) => void
  removeAbsence: (id: string) => void
  approveAbsence: (id: string, by?: string) => void
  rejectAbsence: (id: string, reason?: string) => void
  setVacationBlock: (b: VacationBlock) => void
  addVacationBlock: (b: VacationBlock) => void
  removeVacationBlock: (id: string) => void
}

const AbsencesContext = createContext<AbsencesContextValue | null>(null)

export function AbsencesProvider({ children }: { children: ReactNode }) {
  const [absences, setAbsences] = useState<Absence[]>(() => cloneSeedAbsences())
  const [vacationBlocks, setVacationBlocks] = useState<VacationBlock[]>(() =>
    cloneSeedVacationBlocks(),
  )

  const setAbsence = useCallback((a: Absence) => {
    setAbsences((prev) => prev.map((x) => (x.id === a.id ? a : x)))
  }, [])

  const addAbsence = useCallback((a: Absence) => {
    const id = a.id?.trim() ? a.id : createAbsenceId()
    setAbsences((prev) => [...prev, { ...a, id }])
  }, [])

  const removeAbsence = useCallback((id: string) => {
    setAbsences((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const approveAbsence = useCallback((id: string, by = 'Station') => {
    const now = new Date().toISOString()
    setAbsences((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              status: 'genehmigt' as const,
              approvedBy: by,
              approvedAt: now,
              rejectedReason: undefined,
            }
          : x,
      ),
    )
  }, [])

  const rejectAbsence = useCallback((id: string, reason?: string) => {
    setAbsences((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              status: 'abgelehnt' as const,
              rejectedReason: reason,
              approvedBy: undefined,
              approvedAt: undefined,
            }
          : x,
      ),
    )
  }, [])

  const setVacationBlock = useCallback((b: VacationBlock) => {
    setVacationBlocks((prev) => prev.map((x) => (x.id === b.id ? b : x)))
  }, [])

  const addVacationBlock = useCallback((b: VacationBlock) => {
    const id = b.id?.trim() ? b.id : createVacationBlockId()
    setVacationBlocks((prev) => [...prev, { ...b, id }])
  }, [])

  const removeVacationBlock = useCallback((id: string) => {
    setVacationBlocks((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      absences,
      vacationBlocks,
      setAbsence,
      addAbsence,
      removeAbsence,
      approveAbsence,
      rejectAbsence,
      setVacationBlock,
      addVacationBlock,
      removeVacationBlock,
    }),
    [
      absences,
      vacationBlocks,
      setAbsence,
      addAbsence,
      removeAbsence,
      approveAbsence,
      rejectAbsence,
      setVacationBlock,
      addVacationBlock,
      removeVacationBlock,
    ],
  )

  return <AbsencesContext.Provider value={value}>{children}</AbsencesContext.Provider>
}

export function useAbsences(): AbsencesContextValue {
  const ctx = useContext(AbsencesContext)
  if (!ctx) throw new Error('useAbsences must be used within AbsencesProvider')
  return ctx
}
