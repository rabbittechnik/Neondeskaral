import { useTabletRadio } from '../../context/tablet-radio-context'
import { Button } from '../ui/Button'

export function TabletRadioMiniPlayer() {
  const {
    selectedStationName,
    playStatus,
    play,
    pause,
    stop,
  } = useTabletRadio()

  const active = playStatus === 'playing' || playStatus === 'loading'
  const paused = playStatus === 'paused'

  return (
    <div
      className={`fixed bottom-4 right-4 z-[60] flex max-w-[min(100vw-2rem,22rem)] flex-col gap-2 rounded-2xl border px-3 py-2 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:gap-3 ${
        active || paused
          ? 'border-cyan-500/35 bg-slate-950/90 text-cyan-50'
          : 'border-white/10 bg-slate-950/75 text-slate-500'
      }`}
      role="region"
      aria-label="Tablet-Radio"
    >
      <p className="min-w-0 flex-1 truncate text-xs sm:text-sm">
        <span aria-hidden className="mr-1">
          🎵
        </span>
        {active ? (
          <>
            <span className="font-medium text-cyan-100">{selectedStationName}</span>
            <span className="text-slate-400"> · {playStatus === 'loading' ? 'lädt…' : 'läuft'}</span>
          </>
        ) : paused ? (
          <>
            <span className="font-medium text-slate-200">{selectedStationName}</span>
            <span className="text-slate-500"> · pausiert</span>
          </>
        ) : (
          <span>Radio aus</span>
        )}
      </p>
      <div className="flex shrink-0 flex-wrap gap-1">
        {active ? (
          <>
            <Button type="button" variant="outline" className="h-8 px-2 text-[11px]" onClick={pause}>
              Pause
            </Button>
            <Button type="button" variant="ghost" className="h-8 px-2 text-[11px]" onClick={stop}>
              Stop
            </Button>
          </>
        ) : paused ? (
          <>
            <Button type="button" variant="primary" className="h-8 px-2 text-[11px]" onClick={() => void play()}>
              Play
            </Button>
            <Button type="button" variant="ghost" className="h-8 px-2 text-[11px]" onClick={stop}>
              Stop
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
