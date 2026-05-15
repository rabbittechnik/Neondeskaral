/** Kurzzeit-Cache für Payroll-Reports (Wechsel zwischen Ansichten). */

const TTL_MS = 45_000

type CacheEntry = {
  expiresAt: number
  value: unknown
}

const store = new Map<string, CacheEntry>()

export type PayrollCacheMode = 'combined' | 'combined_summary' | 'schedule' | 'time' | 'employee'

function cacheKey(
  mode: PayrollCacheMode,
  stationId: string,
  from: string,
  to: string,
  extra?: string,
): string {
  return `${mode}|${stationId}|${from}|${to}|${extra ?? ''}`
}

export function getPayrollCached<T>(
  mode: PayrollCacheMode,
  stationId: string,
  from: string,
  to: string,
  extra?: string,
): T | null {
  const key = cacheKey(mode, stationId, from, to, extra)
  const hit = store.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    store.delete(key)
    return null
  }
  return hit.value as T
}

export function setPayrollCached(
  mode: PayrollCacheMode,
  stationId: string,
  from: string,
  to: string,
  value: unknown,
  extra?: string,
): void {
  const key = cacheKey(mode, stationId, from, to, extra)
  store.set(key, { expiresAt: Date.now() + TTL_MS, value })
  if (store.size > 80) {
    const now = Date.now()
    for (const [k, v] of store) {
      if (v.expiresAt < now) store.delete(k)
    }
  }
}

export function invalidatePayrollCacheForStation(stationId: string): void {
  for (const k of store.keys()) {
    if (k.includes(`|${stationId}|`)) store.delete(k)
  }
}

export function clearPayrollCache(): void {
  store.clear()
}
