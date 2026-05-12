import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Absence, VacationBlock } from '../types/absence'
import { createAbsenceId, createVacationBlockId } from '../data/mockAbsences'
import { apiGet, apiSend } from '../services/api'
import { STATION } from '../data/station'

type AbsencesContextValue = {
  absences: Absence[]
  vacationBlocks: VacationBlock[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  setAbsence: (a: Absence) => Promise<void>
  addAbsence: (a: Absence) => Promise<void>
  removeAbsence: (id: string) => Promise<void>
  approveAbsence: (id: string, by?: string) => Promise<void>
  rejectAbsence: (id: string, reason?: string) => Promise<void>
  setVacationBlock: (b: VacationBlock) => Promise<void>
  addVacationBlock: (b: VacationBlock) => Promise<void>
  removeVacationBlock: (id: string) => Promise<void>
}

const AbsencesContext = createContext<AbsencesContextValue | null>(null)

export function AbsencesProvider({ children }: { children: ReactNode }) {
  const [absences, setAbsences] = useState<Absence[]>([])
  const [vacationBlocks, setVacationBlocks] = useState<VacationBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const from = '2025-01-01'
    const to = '2027-12-31'
    const [aRes, vRes] = await Promise.all([
      apiGet<Absence[]>('/absences', { stationId: STATION.id, from, to }),
      apiGet<VacationBlock[]>('/vacation-blocks', { stationId: STATION.id }),
    ])
    if (aRes.ok && Array.isArray(aRes.data)) setAbsences(aRes.data)
    else {
      setAbsences([])
      if (!aRes.ok) setError(aRes.error)
    }
    if (vRes.ok && Array.isArray(vRes.data)) setVacationBlocks(vRes.data)
    else if (!vRes.ok) setError((prev) => (prev ? `${prev}; ${vRes.error}` : vRes.error))
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const setAbsence = useCallback(
    async (a: Absence) => {
      const res = await apiSend<Absence>('PUT', `/absences/${encodeURIComponent(a.id)}`, a)
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const addAbsence = useCallback(
    async (a: Absence) => {
      const id = a.id?.trim() ? a.id : createAbsenceId()
      const res = await apiSend<Absence>('POST', '/absences', { ...a, id }, { stationId: STATION.id })
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const removeAbsence = useCallback(
    async (id: string) => {
      const res = await apiSend('DELETE', `/absences/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const approveAbsence = useCallback(
    async (id: string, by = 'Station') => {
      const res = await apiSend<Absence>('POST', `/absences/${encodeURIComponent(id)}/approve`, { by })
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const rejectAbsence = useCallback(
    async (id: string, reason?: string) => {
      const res = await apiSend<Absence>('POST', `/absences/${encodeURIComponent(id)}/reject`, { reason })
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const setVacationBlock = useCallback(
    async (b: VacationBlock) => {
      const res = await apiSend<VacationBlock>('PUT', `/vacation-blocks/${encodeURIComponent(b.id)}`, b)
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const addVacationBlock = useCallback(
    async (b: VacationBlock) => {
      const id = b.id?.trim() ? b.id : createVacationBlockId()
      const res = await apiSend<VacationBlock>('POST', '/vacation-blocks', { ...b, id }, { stationId: STATION.id })
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const removeVacationBlock = useCallback(
    async (id: string) => {
      const res = await apiSend('DELETE', `/vacation-blocks/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(res.error)
      await refetch()
    },
    [refetch],
  )

  const value = useMemo(
    () => ({
      absences,
      vacationBlocks,
      loading,
      error,
      refetch,
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
      loading,
      error,
      refetch,
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
