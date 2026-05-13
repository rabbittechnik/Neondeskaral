import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mm = window.matchMedia?.('(display-mode: standalone)')?.matches
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  return Boolean(mm || iosStandalone)
}

function platformHint(): string {
  if (typeof window === 'undefined') return 'Browser'
  const ua = window.navigator.userAgent
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'
  return 'Browser'
}

export function PwaInstallPanel() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => isStandalone())
  const [lastOutcome, setLastOutcome] = useState<'accepted' | 'dismissed' | null>(null)

  useEffect(() => {
    const onBip = (e: Event) => {
      // Chrome/Edge: nur wenn installierbar. Wir zeigen dafür einen eigenen Button.
      e.preventDefault?.()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBip as EventListener)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip as EventListener)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    // Live-Refresh, wenn User die App als PWA öffnet
    const id = window.setInterval(() => setInstalled(isStandalone()), 2000)
    return () => window.clearInterval(id)
  }, [])

  const status = useMemo(() => {
    if (installed) return { label: 'Installiert', tone: 'text-emerald-300' as const }
    if (deferred) return { label: 'Installierbar', tone: 'text-cyan-200/95' as const }
    return { label: 'Installation nicht verfügbar', tone: 'text-amber-200' as const }
  }, [installed, deferred])

  const help = useMemo(() => {
    if (installed) return 'App ist auf diesem Gerät bereits installiert.'
    if (deferred) return 'Klicke auf „App installieren“, um Rabbit-Technik Station als App zu installieren.'
    const p = platformHint()
    if (p === 'Safari') {
      return 'Safari: „Teilen“ → „Zum Home-Bildschirm“ (iOS), falls verfügbar.'
    }
    return 'Chrome/Edge: Öffne das Browser-Menü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“, falls verfügbar.'
  }, [installed, deferred])

  const doInstall = async () => {
    if (!deferred) return
    setLastOutcome(null)
    await deferred.prompt()
    try {
      const choice = await deferred.userChoice
      setLastOutcome(choice.outcome)
      if (choice.outcome === 'accepted') {
        setDeferred(null)
        setInstalled(true)
      }
    } catch {
      // ignore
    }
  }

  return (
    <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/70 p-4 shadow-[var(--shadow-card)]">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--text-main)]">Diese App installieren</h2>
        <p className="text-sm text-[var(--text-muted)]">
          App-Name: <span className="text-[var(--text-main)]">Rabbit-Technik Station</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--text-muted)]">
          Status:{' '}
          <span className={`font-semibold ${status.tone}`}>
            {status.label}
          </span>
        </span>
        {deferred && !installed ? (
          <Button type="button" variant="primary" onClick={() => void doInstall()}>
            App auf diesem Gerät installieren
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled>
            {installed ? 'App ist installiert' : 'Installation nicht verfügbar'}
          </Button>
        )}
      </div>

      <p className="text-xs text-[var(--text-faint)]">{help}</p>
      {lastOutcome ? (
        <p className="text-xs text-[var(--text-faint)]">
          Letzte Installation: {lastOutcome === 'accepted' ? 'akzeptiert' : 'abgebrochen'}.
        </p>
      ) : null}
    </section>
  )
}

