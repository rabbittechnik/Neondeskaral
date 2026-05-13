/** Nur PWA-/App-Caches; kein localStorage/sessionStorage. */

export function isManagedCacheKey(name: string): boolean {
  return (
    name.startsWith('rabbit-technik-station-') ||
    name.startsWith('rt-station') ||
    /neonshift|neon-shift|neon/i.test(name)
  )
}

export async function deleteManagedCaches(): Promise<void> {
  if (!('caches' in window)) return
  const keys = await caches.keys()
  await Promise.all(keys.filter(isManagedCacheKey).map((k) => caches.delete(k)))
}

/**
 * Service Worker aktualisieren, verwaltete Caches leeren, Seite neu laden.
 * Tablet-URL / Token bleiben erhalten (kein Storage-Clear).
 */
export async function runTabletAppUpdate(): Promise<void> {
  let reg: ServiceWorkerRegistration | undefined
  if ('serviceWorker' in navigator) {
    try {
      reg = (await navigator.serviceWorker.getRegistration()) ?? undefined
    } catch {
      reg = undefined
    }
    try {
      await reg?.update()
    } catch {
      /* ignore */
    }
    for (let i = 0; i < 15; i++) {
      reg = (await navigator.serviceWorker.getRegistration()) ?? reg
      if (reg?.waiting) break
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  await deleteManagedCaches()

  if (reg?.waiting) {
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.location.reload()
      },
      { once: true },
    )
    try {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    } catch {
      window.location.reload()
    }
    window.setTimeout(() => window.location.reload(), 8000)
    return
  }

  window.location.reload()
}
