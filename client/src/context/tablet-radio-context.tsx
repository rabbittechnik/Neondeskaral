import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { TabletRadioConfig } from '../types/tabletRadioSession'
import {
  TABLET_RADIO_LEGACY_STATION_ID,
  buildTabletRadioStationOptions,
  findPresetIdByStreamUrl,
  type TabletRadioStation,
} from '../data/tabletRadioStations'

const LS_PRESET_KEY = 'rabbit_technik_tablet_radio_station'

export type TabletRadioPlayStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

type TabletRadioContextValue = {
  enabled: boolean
  stationOptions: TabletRadioStation[]
  selectedStationId: string
  selectedStationName: string
  selectedStreamUrl: string | null
  playStatus: TabletRadioPlayStatus
  error: string | null
  statusHint: string | null
  volume: number
  usingFallback: boolean
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  setVolume: (v: number) => void
  volumeUp: () => void
  volumeDown: () => void
  selectStation: (id: string) => void
  retry: () => void
}

const TabletRadioContext = createContext<TabletRadioContextValue | null>(null)

function clampVol(v: number) {
  return Math.min(1, Math.max(0, v))
}

function readSavedPresetId(): string | null {
  try {
    const v = localStorage.getItem(LS_PRESET_KEY)?.trim()
    return v || null
  } catch {
    return null
  }
}

function writeSavedPresetId(id: string) {
  try {
    localStorage.setItem(LS_PRESET_KEY, id)
  } catch {
    /* ignore */
  }
}

function pickInitialStationId(config: TabletRadioConfig, options: TabletRadioStation[]): string {
  const saved = readSavedPresetId()
  if (saved && options.some((o) => o.id === saved)) return saved
  const def = config.defaultPresetId?.trim()
  if (def && options.some((o) => o.id === def)) return def
  const byUrl = findPresetIdByStreamUrl(config.streamUrl)
  if (byUrl && options.some((o) => o.id === byUrl)) return byUrl
  if (config.streamUrl?.trim() && options.some((o) => o.id === TABLET_RADIO_LEGACY_STATION_ID)) {
    return TABLET_RADIO_LEGACY_STATION_ID
  }
  return options[0]?.id ?? 'bigfm-bw'
}

function resolveStation(options: TabletRadioStation[], id: string): TabletRadioStation | undefined {
  return options.find((o) => o.id === id)
}

export function TabletRadioProvider({
  children,
  config,
}: {
  children: ReactNode
  config: TabletRadioConfig
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const volumeRef = useRef(0.5)
  const playStatusRef = useRef<TabletRadioPlayStatus>('idle')
  const usingFallbackRef = useRef(false)
  const currentPrimaryUrlRef = useRef<string | null>(null)

  const stationOptions = useMemo(() => buildTabletRadioStationOptions(config), [config])

  const [selectedStationId, setSelectedStationId] = useState(() => pickInitialStationId(config, stationOptions))
  const [playStatus, setPlayStatus] = useState<TabletRadioPlayStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState<string | null>(() => {
    const sid = pickInitialStationId(config, stationOptions)
    const n = resolveStation(stationOptions, sid)?.name
    return n ? `Bereit zum Abspielen · ${n}` : null
  })
  const [volume, setVolumeState] = useState(() => clampVol(config.defaultVolume))
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    volumeRef.current = clampVol(config.defaultVolume)
    setVolumeState(clampVol(config.defaultVolume))
  }, [config.defaultVolume])

  useEffect(() => {
    if (!resolveStation(stationOptions, selectedStationId)) {
      const fb = stationOptions[0]?.id
      if (fb) {
        setSelectedStationId(fb)
        const n = resolveStation(stationOptions, fb)?.name
        if (n) setStatusHint(`Bereit zum Abspielen · ${n}`)
      }
    }
  }, [stationOptions, selectedStationId])

  useEffect(() => {
    playStatusRef.current = playStatus
  }, [playStatus])

  useEffect(() => {
    usingFallbackRef.current = usingFallback
  }, [usingFallback])

  const selectedStation = useMemo(
    () => resolveStation(stationOptions, selectedStationId),
    [stationOptions, selectedStationId],
  )

  const selectedStationName = selectedStation?.name ?? '—'
  const selectedStreamUrl = selectedStation?.streamUrl?.trim() ?? null

  useEffect(() => {
    const a = new Audio()
    a.preload = 'none'
    audioRef.current = a

    const onPlaying = () => {
      setPlayStatus('playing')
      setError(null)
      setStatusHint(null)
    }
    const onPause = () => {
      setPlayStatus((s) => (s === 'error' ? s : 'paused'))
    }
    const onWaiting = () => {
      if (playStatusRef.current === 'playing' || playStatusRef.current === 'loading') {
        setPlayStatus('loading')
      }
    }
    const onError = () => {
      setPlayStatus('error')
      setError('Radio-Stream konnte nicht geladen werden.')
    }
    const onEnded = () => setPlayStatus('paused')

    a.addEventListener('playing', onPlaying)
    a.addEventListener('pause', onPause)
    a.addEventListener('waiting', onWaiting)
    a.addEventListener('stalled', onWaiting)
    a.addEventListener('error', onError)
    a.addEventListener('ended', onEnded)

    return () => {
      a.pause()
      a.removeAttribute('src')
      a.load()
      a.removeEventListener('playing', onPlaying)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('waiting', onWaiting)
      a.removeEventListener('stalled', onWaiting)
      a.removeEventListener('error', onError)
      a.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [])

  const applyVolume = useCallback((v: number) => {
    const c = clampVol(v)
    volumeRef.current = c
    setVolumeState(c)
    const a = audioRef.current
    if (a) a.volume = c
  }, [])

  const stopInternal = useCallback(() => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
    currentPrimaryUrlRef.current = null
    usingFallbackRef.current = false
    setUsingFallback(false)
  }, [])

  const loadAndPlay = useCallback(
    async (opts?: { preferFallback?: boolean; stationId?: string }) => {
      const sid = opts?.stationId ?? selectedStationId
      const st = resolveStation(stationOptions, sid)
      const preferFb = opts?.preferFallback ?? false
      const primary = st?.streamUrl?.trim() ?? ''
      const fallback = st?.streamUrlFallback?.trim() ?? ''
      const url = preferFb ? fallback || primary : primary || fallback

      if (!url) {
        setError('Für diesen Sender ist keine Stream-URL hinterlegt.')
        setPlayStatus('error')
        return
      }

      if (preferFb && fallback) setUsingFallback(true)
      else if (!preferFb) setUsingFallback(false)

      const a = audioRef.current
      if (!a) return

      setError(null)
      setPlayStatus('loading')
      a.volume = volumeRef.current

      try {
        if (currentPrimaryUrlRef.current !== url) {
          a.src = url
          a.load()
          currentPrimaryUrlRef.current = url
        }
        await a.play()
      } catch {
        if (!preferFb && fallback) {
          usingFallbackRef.current = true
          setUsingFallback(true)
          const a2 = audioRef.current
          if (a2) {
            try {
              setPlayStatus('loading')
              a2.src = fallback
              a2.load()
              currentPrimaryUrlRef.current = fallback
              await a2.play()
              return
            } catch {
              /* fall through */
            }
          }
        }
        setPlayStatus('error')
        setError('Radio-Stream konnte nicht geladen werden.')
      }
    },
    [selectedStationId, stationOptions],
  )

  const play = useCallback(async () => {
    await loadAndPlay({ preferFallback: usingFallbackRef.current })
  }, [loadAndPlay])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setPlayStatus('paused')
  }, [])

  const stop = useCallback(() => {
    stopInternal()
    setPlayStatus('idle')
    setError(null)
    setStatusHint(null)
  }, [stopInternal])

  const selectStation = useCallback(
    (id: string) => {
      if (!resolveStation(stationOptions, id)) return
      const wasPlaying = playStatusRef.current === 'playing'
      const wasLoading = playStatusRef.current === 'loading'
      writeSavedPresetId(id)
      const name = resolveStation(stationOptions, id)?.name ?? id
      setSelectedStationId(id)
      if (wasPlaying || wasLoading) {
        stopInternal()
        setPlayStatus('loading')
        setStatusHint(null)
        void loadAndPlay({ preferFallback: false, stationId: id }).then(() => {
          setStatusHint(`Sender geladen: ${name}`)
        })
      } else {
        stopInternal()
        setPlayStatus('idle')
        setError(null)
        setStatusHint(`Bereit zum Abspielen · ${name}`)
      }
    },
    [stationOptions, stopInternal, loadAndPlay],
  )

  const retry = useCallback(() => {
    setError(null)
    if (!usingFallbackRef.current) {
      const st = resolveStation(stationOptions, selectedStationId)
      const fb = st?.streamUrlFallback?.trim()
      if (fb) {
        void loadAndPlay({ preferFallback: true })
        return
      }
    }
    void loadAndPlay({ preferFallback: usingFallbackRef.current })
  }, [loadAndPlay, selectedStationId, stationOptions])

  const volumeUp = useCallback(() => applyVolume(volumeRef.current + 0.1), [applyVolume])
  const volumeDown = useCallback(() => applyVolume(volumeRef.current - 0.1), [applyVolume])
  const setVolume = useCallback((v: number) => applyVolume(v), [applyVolume])

  const value = useMemo(
    () => ({
      enabled: true,
      stationOptions,
      selectedStationId,
      selectedStationName,
      selectedStreamUrl,
      playStatus,
      error,
      statusHint,
      volume,
      usingFallback,
      play,
      pause,
      stop,
      setVolume,
      volumeUp,
      volumeDown,
      selectStation,
      retry,
    }),
    [
      stationOptions,
      selectedStationId,
      selectedStationName,
      selectedStreamUrl,
      playStatus,
      error,
      statusHint,
      volume,
      usingFallback,
      play,
      pause,
      stop,
      setVolume,
      volumeUp,
      volumeDown,
      selectStation,
      retry,
    ],
  )

  return <TabletRadioContext.Provider value={value}>{children}</TabletRadioContext.Provider>
}

export function useTabletRadio(): TabletRadioContextValue {
  const ctx = useContext(TabletRadioContext)
  if (!ctx) throw new Error('useTabletRadio must be used within TabletRadioProvider')
  return ctx
}
