import { useTabletRadio } from '../../context/tablet-radio-context'
import { Button } from '../ui/Button'

function statusLabel(playStatus: string): string {
  switch (playStatus) {
    case 'idle':
      return 'Bereit'
    case 'loading':
      return 'Lädt…'
    case 'playing':
      return 'Läuft'
    case 'paused':
      return 'Pausiert'
    case 'error':
      return 'Fehler'
    default:
      return playStatus
  }
}

export function TabletRadioTab() {
  const radio = useTabletRadio()
  const {
    stationOptions,
    selectedStationId,
    selectedStationName,
    playStatus,
    error,
    statusHint,
    volume,
    usingFallback,
    play,
    pause,
    stop,
    volumeUp,
    volumeDown,
    selectStation,
    retry,
  } = radio

  const hasStreams = stationOptions.some((s) => Boolean(s.streamUrl?.trim()))

  if (!hasStreams) {
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
        {playStatus === 'playing' ? (
          <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
            <div className="absolute bottom-0 left-0 right-0 flex h-24 items-end justify-center gap-1 pb-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="w-2 animate-pulse rounded-full bg-cyan-400/80"
                  style={{
                    height: `${12 + (i % 3) * 10 + 8}px`,
                    animationDuration: `${0.5 + i * 0.12}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="relative space-y-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/90">Musik / Radio</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{selectedStationName}</h2>
            <p className="mt-1 text-sm text-cyan-100/80">Aktueller Sender</p>
          </div>

          <label className="block text-xs font-medium text-slate-400">
            Radiosender auswählen
            <select
              id="tablet-radio-station-select"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-3 text-base text-white outline-none focus:border-cyan-500/50"
              value={selectedStationId}
              onChange={(e) => selectStation(e.target.value)}
            >
              {stationOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            <p className="text-[var(--text-muted)]">
              Status:{' '}
              <span
                className={
                  playStatus === 'playing'
                    ? 'text-emerald-300'
                    : playStatus === 'error'
                      ? 'text-rose-300'
                      : 'text-slate-200'
                }
              >
                {statusLabel(playStatus)}
              </span>
            </p>
            {statusHint ? <p className="mt-1 text-xs text-slate-400">{statusHint}</p> : null}
            {playStatus === 'playing' ? (
              <p className="mt-1 text-[11px] text-emerald-200/80">Läuft im Hintergrund weiter, auch bei anderen Tabs.</p>
            ) : null}
            {usingFallback ? (
              <p className="mt-1 text-[11px] text-slate-500">Alternativ-Stream aktiv (AAC/MP3)</p>
            ) : null}
          </div>

          {error ? <p className="text-center text-sm text-rose-200/90">{error}</p> : null}

          <div className="flex flex-col items-center gap-4">
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
              <Button type="button" variant="outline" className="rounded-xl px-4" onClick={volumeDown}>
                − Leiser
              </Button>
              <Button type="button" variant="outline" className="rounded-xl px-4" onClick={volumeUp}>
                + Lauter
              </Button>
            </div>

            <p className="text-sm text-cyan-100/90">
              Lautstärke: <span className="font-mono tabular-nums">{Math.round(volume * 100)} %</span>
            </p>

            {playStatus === 'error' ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="primary" className="rounded-xl" onClick={() => void retry()}>
                  Erneut versuchen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => document.getElementById('tablet-radio-station-select')?.focus()}
                >
                  Anderen Sender wählen
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-md text-center text-[11px] text-slate-500">
        Wiedergabe startet erst nach Tipp auf Play (kein Autoplay). Nach dem Start läuft das Radio beim Wechsel zu
        Stempeln, Schichtplan, Aufgaben oder Spritpreisen weiter.
      </p>
    </div>
  )
}
