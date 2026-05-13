import { useCallback, useEffect, useRef, useState } from 'react'
import type { TabletRadioConfig } from '../../context/tablet-terminal-context'
import { Button } from '../ui/Button'

type Props = {
  config: TabletRadioConfig
}

type PlayStatus = 'idle' | 'playing' | 'paused' | 'error'

function clampVol(v: number) {
  return Math.min(1, Math.max(0, v))
}

export function TabletRadioTab({ config }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [status, setStatus] = useState<PlayStatus>('idle')
  const [vol, setVol] = useState(() => clampVol(config.defaultVolume))

  useEffect(() => {
    setVol(clampVol(config.defaultVolume))
  }, [config.defaultVolume])

  const hasAnyUrl = Boolean(config.streamUrl?.trim() || config.streamUrlFallback?.trim())

  const stopAudio = useCallback(() => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.removeAttribute('src')
      a.load()
    }
    audioRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopAudio()
    }
  }, [stopAudio])

  const attachAudio = useCallback(
    (url: string, volume: number) => {
      stopAudio()
      const a = new Audio(url)
      a.preload = 'none'
      a.volume = volume
      a.addEventListener('playing', () => setStatus('playing'))
      a.addEventListener('pause', () => setStatus((s) => (s === 'error' ? s : 'paused')))
      a.addEventListener('ended', () => setStatus('paused'))
      a.addEventListener('error', () => setStatus('error'))
      audioRef.current = a
      return a
    },
    [stopAudio],
  )

  const play = async (opts?: { preferFallback?: boolean }) => {
    const useFb = opts?.preferFallback ?? usingFallback
    if (opts?.preferFallback != null) setUsingFallback(Boolean(opts.preferFallback))
    const primary = config.streamUrl?.trim()
    const fallback = config.streamUrlFallback?.trim()
    const url = useFb ? fallback || primary : primary || fallback
    if (!url) {
      setStatus('error')
      return
    }
    try {
      const a = attachAudio(url, vol)
      await a.play()
    } catch {
      setStatus('error')
    }
  }

  const pause = () => {
    audioRef.current?.pause()
    setStatus('paused')
  }

  const stop = () => {
    stopAudio()
    setStatus('idle')
  }

  const louder = () => {
    const next = clampVol(vol + 0.1)
    setVol(next)
    if (audioRef.current) audioRef.current.volume = next
  }

  const quieter = () => {
    const next = clampVol(vol - 0.1)
    setVol(next)
    if (audioRef.current) audioRef.current.volume = next
  }

  const retry = () => {
    setStatus('idle')
    if (status === 'error' && !usingFallback && config.streamUrlFallback?.trim()) {
      void play({ preferFallback: true })
      return
    }
    void play()
  }

  const statusLabel =
    status === 'playing'
      ? 'Läuft'
      : status === 'paused'
        ? 'Gestoppt'
        : status === 'error'
          ? 'Fehler'
          : 'Bereit zum Abspielen'

  const displayName = config.streamName?.trim() || 'Webradio'

  if (!hasAnyUrl) {
    return (
      <div className="mx-auto mt-10 w-full max-w-lg rounded-2xl border border-amber-500/25 bg-amber-500/5 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-amber-100">Musik / Radio</p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Für diese Station ist noch kein Radio-Stream hinterlegt.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-lg px-2">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-950/95 via-[#0a1628] to-fuchsia-950/40 p-6 shadow-[0_0_48px_rgba(34,211,238,0.12)]">
        {status === 'playing' ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden
          >
            <div className="absolute bottom-0 left-0 right-0 flex h-24 items-end justify-center gap-1 pb-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="w-2 rounded-full bg-cyan-400/80 animate-pulse"
                  style={{
                    height: `${12 + (i % 3) * 10 + 8}px`,
                    animationDuration: `${0.5 + i * 0.12}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="relative">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/90">Musik / Radio</p>
          <h2 className="mt-2 text-center text-2xl font-bold text-white">{displayName}</h2>
          <p className="mt-1 text-center text-sm text-cyan-100/80">Live-Webradio für die Station</p>

          <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
            Status:{' '}
            <span
              className={
                status === 'playing'
                  ? 'text-emerald-300'
                  : status === 'error'
                    ? 'text-rose-300'
                    : 'text-slate-300'
              }
            >
              {statusLabel}
            </span>
            {usingFallback && config.streamUrlFallback ? (
              <span className="mt-1 block text-[11px] text-slate-500">AAC-/Alternativ-Stream aktiv</span>
            ) : null}
          </p>

          {status === 'error' ? (
            <p className="mt-3 text-center text-sm text-rose-200/90">Radio-Stream konnte nicht geladen werden.</p>
          ) : null}

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="primary"
                className="min-h-[56px] min-w-[160px] rounded-xl text-lg font-semibold shadow-[0_0_24px_rgba(34,211,238,0.35)]"
                onClick={() => void play()}
              >
                ▶ Play
              </Button>
              <Button type="button" variant="outline" className="min-h-[56px] min-w-[120px] rounded-xl text-base" onClick={pause}>
                ⏸ Pause
              </Button>
              <Button type="button" variant="ghost" className="min-h-[56px] min-w-[100px] rounded-xl text-base" onClick={stop}>
                Stop
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="outline" className="rounded-xl px-4" onClick={quieter}>
                − Leiser
              </Button>
              <Button type="button" variant="outline" className="rounded-xl px-4" onClick={louder}>
                + Lauter
              </Button>
            </div>

            <p className="text-sm text-cyan-100/90">
              Lautstärke: <span className="font-mono tabular-nums">{Math.round(vol * 100)} %</span>
            </p>

            {status === 'error' ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="primary" className="rounded-xl" onClick={() => retry()}>
                  Erneut versuchen
                </Button>
                {!usingFallback && config.streamUrlFallback?.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      stop()
                      setStatus('idle')
                      void play({ preferFallback: true })
                    }}
                  >
                    AAC-Stream testen
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-md text-center text-[11px] text-slate-500">
        Wiedergabe startet erst nach Tipp auf Play (kein Autoplay). Ton und Stream hängen vom Browser / iPad ab.
      </p>
    </div>
  )
}
