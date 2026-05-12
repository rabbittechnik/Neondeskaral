import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { GermanState } from '../data/germanHolidays'
import { DEFAULT_TABLET_STATION_ID } from '../data/station'
import { useAuth } from './auth-context'

export type StationSummary = {
  id: string
  name: string
  federalState: GermanState
  brand?: string
  city?: string
}

type StationContextValue = {
  selectedStation: StationSummary | null
  availableStations: StationSummary[]
  canSwitchStation: boolean
  setSelectedStationId: (id: string) => void
  stationId: string | null
  /** Bundesland der aktuellen Station (Kalender/Feiertage). */
  federalState: GermanState
  hasPermission: (key: string) => boolean
}

const StationContext = createContext<StationContextValue | null>(null)

const LS_PREFIX = 'neonshift_station_'

function toGermanState(raw: string | undefined): GermanState {
  const s = String(raw ?? 'BW').toUpperCase()
  const allowed: GermanState[] = [
    'BW',
    'BY',
    'BE',
    'BB',
    'HB',
    'HH',
    'HE',
    'MV',
    'NI',
    'NW',
    'RP',
    'SL',
    'SN',
    'ST',
    'SH',
    'TH',
  ]
  return (allowed.includes(s as GermanState) ? s : 'BW') as GermanState
}

function mapStations(user: ReturnType<typeof useAuth>['user']): StationSummary[] {
  const raw = user?.stations ?? []
  if (raw.length > 0) {
    return raw.map((s) => ({
      id: s.id,
      name: s.name,
      federalState: toGermanState(s.federalState),
      brand: s.brand,
      city: s.city,
    }))
  }
  return [
    {
      id: DEFAULT_TABLET_STATION_ID,
      name: 'Station (Terminal)',
      federalState: toGermanState('BW'),
    },
  ]
}

export function StationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const availableStations = useMemo(() => mapStations(user), [user])
  const canSwitchStation = Boolean(user && user.canSwitchStation && availableStations.length > 1)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (availableStations.length === 0) {
      setSelectedId(null)
      return
    }
    if (user) {
      const key = `${LS_PREFIX}${user.id}`
      const fromLs = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      const pick =
        (fromLs && availableStations.some((s) => s.id === fromLs) ? fromLs : null) ??
        availableStations[0]!.id
      setSelectedId(pick)
    } else {
      setSelectedId(availableStations[0]!.id)
    }
  }, [user, availableStations])

  const setSelectedStationId = useCallback(
    (id: string) => {
      if (!availableStations.some((s) => s.id === id)) return
      if (user) {
        if (!user.globalAdmin && !user.canSwitchStation) return
        if (!user.globalAdmin && user.stationAccess && !user.stationAccess.some((a) => a.stationId === id)) return
        try {
          window.localStorage.setItem(`${LS_PREFIX}${user.id}`, id)
        } catch {
          /* ignore */
        }
      }
      setSelectedId(id)
    },
    [user, availableStations],
  )

  const selectedStation = useMemo(
    () => availableStations.find((s) => s.id === selectedId) ?? availableStations[0] ?? null,
    [availableStations, selectedId],
  )

  const hasPermission = useCallback(
    (key: string) => {
      if (!selectedStation) return false
      if (!user) return true
      if (user.globalAdmin) return true
      const row = user.stationAccess?.find((a) => a.stationId === selectedStation.id)
      return row?.permissions[key] === true
    },
    [user, selectedStation],
  )

  const value = useMemo<StationContextValue>(
    () => ({
      selectedStation,
      availableStations,
      canSwitchStation,
      setSelectedStationId,
      stationId: selectedStation?.id ?? null,
      federalState: selectedStation?.federalState ?? 'BW',
      hasPermission,
    }),
    [selectedStation, availableStations, canSwitchStation, setSelectedStationId, hasPermission],
  )

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>
}

export function useStation(): StationContextValue {
  const ctx = useContext(StationContext)
  if (!ctx) throw new Error('useStation must be used within StationProvider')
  return ctx
}
