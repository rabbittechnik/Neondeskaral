import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { runTabletAppUpdate } from '../../utils/tabletPwaUpdate'
import { Button } from '../ui/Button'

function formatBuildDe(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type Props = {
  /** Nur bei echtem Tablet-Token (kein /tablet/dev). */
  enabled: boolean
}

export function TabletPwaUpdateControls({ enabled }: Props) {
  const [updateHint, setUpdateHint] = useState(false)
  const [busy, setBusy] = useState(false)

  const checkWaiting = useCallback(() => {
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) setUpdateHint(true)
    })
  }, [])

  useEffect(() => {
    if (!enabled) return
    checkWaiting()
  }, [enabled, checkWaiting])

  useEffect(() => {
    if (!enabled) return
    if (!('serviceWorker' in navigator)) return

    let cancelled = false
    const attach = async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg || cancelled) return
      if (reg.waiting) setUpdateHint(true)

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (cancelled) return
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateHint(true)
          }
        })
      })
    }
    void attach()
    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    if (!('serviceWorker' in navigator)) return
    const id = window.setInterval(() => {
      void navigator.serviceWorker.getRegistration().then((r) => {
        void r?.update().catch(() => {})
        if (r?.waiting) setUpdateHint(true)
      })
    }, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [enabled])

  const onUpdate = () => {
    setBusy(true)
    void runTabletAppUpdate()
  }

  if (!enabled) return null

  const versionLine = `v${__APP_VERSION__} · Stand ${formatBuildDe(__BUILD_TIME_ISO__)}`

  return (
    <>
      {updateHint ? (
        <div className="fixed left-3 right-3 top-3 z-[200] flex flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-sm text-amber-100 shadow-lg backdrop-blur-sm sm:left-auto sm:right-4 sm:top-4 sm:max-w-md">
          <span>Neue Version verfügbar</span>
          <Button
            type="button"
            variant="primary"
            className="px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={onUpdate}
          >
            Aktualisieren
          </Button>
        </div>
      ) : null}

      <div className="fixed bottom-12 right-3 z-[199] sm:bottom-14 sm:right-4">
        <Button
          type="button"
          variant="outline"
          className="border-cyan-400/40 bg-[var(--bg-card)]/90 px-3 py-2 text-xs shadow-md backdrop-blur-sm"
          disabled={busy}
          leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />}
          onClick={onUpdate}
          title="App aktualisieren (Cache & Service Worker)"
        >
          App aktualisieren
        </Button>
      </div>

      <div className="pointer-events-none fixed bottom-2 left-0 right-0 z-[198] text-center text-[10px] leading-tight text-[var(--text-faint)]">
        <span className="opacity-90">Rabbit-Technik Station</span>
        <span className="mx-1 opacity-50">·</span>
        <span>{versionLine}</span>
      </div>
    </>
  )
}
