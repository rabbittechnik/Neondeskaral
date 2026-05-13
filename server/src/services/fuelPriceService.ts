import type { Database } from 'better-sqlite3'
import { nowIso } from '../utils/timestamps.js'

const LIST_URL = 'https://creativecommons.tankerkoenig.de/json/list.php'
const PRICES_URL = 'https://creativecommons.tankerkoenig.de/json/prices.php'
const CACHE_MS = 5 * 60 * 1000

/** Fallback-Umkreissuche für Aral Bodelshausen (Tankerkönig list.php). */
export const ARAL_BODELSHAUSEN_SEARCH = {
  lat: 48.38732,
  lng: 8.97903,
  rad: 1.5,
} as const

export type FuelPriceSuccess = {
  ok: true
  configured: true
  provider: 'tankerkoenig'
  stationId: string
  providerStationId: string
  station: {
    name: string
    brand: string
    street: string
    houseNumber: string
    postCode: string
    place: string
  }
  prices: { diesel: number; e5: number; e10: number }
  isOpen: boolean
  currency: 'EUR'
  source: string
  fetchedAt: string
  /** Nur wenn Live-Abruf fehlschlug und alter Cache geliefert wird. */
  cacheWarning?: string
}

export type FuelPriceError = {
  ok: false
  configured: boolean
  message: string
  cacheWarning?: string
}

export type FuelPriceResponse = FuelPriceSuccess | FuelPriceError

type TankerStation = Record<string, unknown>

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

/** Später: direkter Abruf über prices.php (schneller). */
export function tankerkoenigPricesUrl(ids: string, apiKey: string): string {
  const u = new URL(PRICES_URL)
  u.searchParams.set('ids', ids)
  u.searchParams.set('apikey', apiKey)
  return u.toString()
}

function parseStationsArray(raw: unknown): TankerStation[] {
  if (Array.isArray(raw)) return raw as TankerStation[]
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.stations)) return o.stations as TankerStation[]
    const inner = o.stations
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return Object.values(inner as Record<string, unknown>).filter((x) => x && typeof x === 'object') as TankerStation[]
    }
  }
  return []
}

function matchesAralBodelshausen(s: TankerStation): boolean {
  const brand = str(s.brand).toUpperCase()
  const name = str(s.name).toUpperCase()
  if (!brand.includes('ARAL') && !name.includes('ARAL')) return false
  const street = str(s.street)
  if (!/bahnhofstr\.?/i.test(street)) return false
  const houseRaw = s.houseNumber ?? s.house_number
  const house = houseRaw != null && typeof houseRaw === 'number' ? String(houseRaw) : str(houseRaw)
  if (house !== '84') return false
  const pc = str(s.postCode ?? s.postalCode ?? s.postcode)
  if (pc !== '72411') return false
  const place = str(s.place).toLowerCase()
  if (!place.includes('bodelshausen')) return false
  return true
}

function pickBestStation(stations: TankerStation[]): TankerStation | undefined {
  const matched = stations.filter(matchesAralBodelshausen)
  if (matched.length === 0) return undefined
  matched.sort((a, b) => (num(a.dist) ?? 999) - (num(b.dist) ?? 999))
  return matched[0]
}

function readCacheRow(db: Database, stationId: string) {
  const id = cacheRowId(stationId)
  return db.prepare(`SELECT * FROM fuel_price_cache WHERE id = ?`).get(id) as
    | {
        id: string
        station_id: string
        provider: string
        provider_station_id: string | null
        status: string | null
        is_open: number | null
        e5: number | null
        e10: number | null
        diesel: number | null
        currency: string | null
        raw_json: string | null
        fetched_at: string | null
      }
    | undefined
}

function cacheRowId(stationId: string) {
  return `tankerkoenig-${stationId}`
}

function cacheAgeMs(fetchedAt: string | null | undefined): number {
  if (!fetchedAt) return Number.POSITIVE_INFINITY
  const t = Date.parse(fetchedAt)
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return Date.now() - t
}

function rowToSuccess(
  stationId: string,
  providerStationId: string,
  meta: {
    name: string
    brand: string
    street: string
    houseNumber: string
    postCode: string
    place: string
    diesel: number
    e5: number
    e10: number
    isOpen: boolean
    fetchedAt: string
  },
  cacheWarning?: string,
): FuelPriceSuccess {
  return {
    ok: true,
    configured: true,
    provider: 'tankerkoenig',
    stationId,
    providerStationId,
    station: {
      name: meta.name,
      brand: meta.brand,
      street: meta.street,
      houseNumber: meta.houseNumber,
      postCode: meta.postCode,
      place: meta.place,
    },
    prices: { diesel: meta.diesel, e5: meta.e5, e10: meta.e10 },
    isOpen: meta.isOpen,
    currency: 'EUR',
    source: 'Tankerkönig / MTS-K',
    fetchedAt: meta.fetchedAt,
    ...(cacheWarning ? { cacheWarning } : {}),
  }
}

function persistCache(
  db: Database,
  stationId: string,
  picked: TankerStation,
  diesel: number,
  e5: number,
  e10: number,
  isOpen: boolean,
  rawJson: string,
) {
  const ts = nowIso()
  const id = cacheRowId(stationId)
  const providerStationId = str(picked.id)
  db.prepare(
    `INSERT INTO fuel_price_cache (
      id, station_id, provider, provider_station_id, status, is_open, e5, e10, diesel, currency, raw_json, fetched_at, created_at, updated_at
    ) VALUES (?, ?, 'tankerkoenig', ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider_station_id = excluded.provider_station_id,
      status = excluded.status,
      is_open = excluded.is_open,
      e5 = excluded.e5,
      e10 = excluded.e10,
      diesel = excluded.diesel,
      raw_json = excluded.raw_json,
      fetched_at = excluded.fetched_at,
      updated_at = excluded.updated_at`,
  ).run(
    id,
    stationId,
    providerStationId,
    isOpen ? 'open' : 'closed',
    isOpen ? 1 : 0,
    e5,
    e10,
    diesel,
    rawJson,
    ts,
    ts,
    ts,
  )

  if (stationId === 'aral-bodelshausen' && providerStationId) {
    db.prepare(`UPDATE stations SET tankerkoenig_station_id = ?, updated_at = ? WHERE id = ? AND (tankerkoenig_station_id IS NULL OR trim(tankerkoenig_station_id) = '')`).run(
      providerStationId,
      ts,
      stationId,
    )
  }
}

async function fetchListLive(lat: number, lng: number, apiKey: string): Promise<{ ok: boolean; stations: TankerStation[]; rawText: string }> {
  const u = new URL(LIST_URL)
  u.searchParams.set('lat', String(lat))
  u.searchParams.set('lng', String(lng))
  u.searchParams.set('rad', String(ARAL_BODELSHAUSEN_SEARCH.rad))
  u.searchParams.set('sort', 'dist')
  u.searchParams.set('type', 'all')
  u.searchParams.set('apikey', apiKey)
  const res = await fetch(u.toString(), { method: 'GET', headers: { Accept: 'application/json' } })
  const rawText = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(rawText) as Record<string, unknown>
  } catch {
    return { ok: false, stations: [], rawText }
  }
  if (json.ok === false) {
    return { ok: false, stations: [], rawText }
  }
  const stations = parseStationsArray(json.stations ?? json)
  return { ok: true, stations, rawText }
}

function normalizeFromPick(stationId: string, picked: TankerStation, fetchedAt: string, cacheWarning?: string): FuelPriceSuccess {
  const diesel = num(picked.diesel) ?? 0
  const e5 = num(picked.e5) ?? 0
  const e10 = num(picked.e10) ?? 0
  const isOpen = Boolean(picked.isOpen ?? picked.open)
  return rowToSuccess(
    stationId,
    str(picked.id),
    {
      name: str(picked.name),
      brand: str(picked.brand),
      street: str(picked.street),
      houseNumber: str(picked.houseNumber ?? picked.house_number),
      postCode: str(picked.postCode ?? picked.postalCode),
      place: str(picked.place),
      diesel,
      e5,
      e10,
      isOpen,
      fetchedAt,
    },
    cacheWarning,
  )
}

export async function getFuelPricesForStation(
  db: Database,
  stationId: string,
  opts?: { forceRefresh?: boolean },
): Promise<FuelPriceResponse> {
  const sid = String(stationId ?? '').trim() || 'aral-bodelshausen'
  const apiKey = String(process.env.TANKERKOENIG_API_KEY ?? '').trim()
  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      message: 'Tankerkönig API-Key ist nicht konfiguriert.',
    }
  }

  const row = readCacheRow(db, sid)
  const freshEnough = row && cacheAgeMs(row.fetched_at) < CACHE_MS && !opts?.forceRefresh
  if (freshEnough && row && row.e5 != null && row.e10 != null && row.diesel != null && row.provider_station_id) {
    let raw: TankerStation = {}
    try {
      raw = row.raw_json ? (JSON.parse(row.raw_json) as TankerStation) : {}
    } catch {
      raw = {}
    }
    const picked = { ...raw, id: row.provider_station_id }
    return normalizeFromPick(sid, picked, row.fetched_at ?? nowIso())
  }

  let lat = ARAL_BODELSHAUSEN_SEARCH.lat
  let lng = ARAL_BODELSHAUSEN_SEARCH.lng
  if (sid === 'aral-bodelshausen') {
    lat = ARAL_BODELSHAUSEN_SEARCH.lat
    lng = ARAL_BODELSHAUSEN_SEARCH.lng
  }

  try {
    const live = await fetchListLive(lat, lng, apiKey)
    if (!live.ok || live.stations.length === 0) {
      if (row && row.e5 != null && row.e10 != null && row.diesel != null && row.provider_station_id) {
        let raw: TankerStation = {}
        try {
          raw = row.raw_json ? (JSON.parse(row.raw_json) as TankerStation) : {}
        } catch {
          raw = {}
        }
        const picked = { ...raw, id: row.provider_station_id }
        return normalizeFromPick(sid, picked, row.fetched_at ?? nowIso(), 'Preise konnten nicht aktualisiert werden. Es werden zuletzt gespeicherte Preise angezeigt.')
      }
      return {
        ok: false,
        configured: true,
        message: 'Spritpreise konnten nicht aktualisiert werden.',
      }
    }
    const picked = pickBestStation(live.stations)
    if (!picked || !str(picked.id)) {
      if (row && row.e5 != null && row.e10 != null && row.diesel != null && row.provider_station_id) {
        let raw: TankerStation = {}
        try {
          raw = row.raw_json ? (JSON.parse(row.raw_json) as TankerStation) : {}
        } catch {
          raw = {}
        }
        const fallbackPick = { ...raw, id: row.provider_station_id }
        return normalizeFromPick(sid, fallbackPick, row.fetched_at ?? nowIso(), 'Aral Bodelshausen wurde in der Tankerkönig-Umkreissuche nicht gefunden. Es werden zuletzt gespeicherte Preise angezeigt.')
      }
      return {
        ok: false,
        configured: true,
        message: 'Aral Bodelshausen wurde in der Tankerkönig-Umkreissuche nicht gefunden.',
      }
    }
    const diesel = num(picked.diesel)
    const e5 = num(picked.e5)
    const e10 = num(picked.e10)
    if (diesel == null || e5 == null || e10 == null) {
      if (row && row.e5 != null && row.e10 != null && row.diesel != null && row.provider_station_id) {
        let raw: TankerStation = {}
        try {
          raw = row.raw_json ? (JSON.parse(row.raw_json) as TankerStation) : {}
        } catch {
          raw = {}
        }
        const fallbackPick = { ...raw, id: row.provider_station_id }
        return normalizeFromPick(sid, fallbackPick, row.fetched_at ?? nowIso(), 'Preise konnten nicht aktualisiert werden. Es werden zuletzt gespeicherte Preise angezeigt.')
      }
      return { ok: false, configured: true, message: 'Spritpreise konnten nicht aktualisiert werden.' }
    }
    const ts = nowIso()
    const rawJson = JSON.stringify(picked)
    persistCache(db, sid, picked, diesel, e5, e10, Boolean(picked.isOpen ?? picked.open), rawJson)
    return normalizeFromPick(sid, picked, ts)
  } catch {
    if (row && row.e5 != null && row.e10 != null && row.diesel != null && row.provider_station_id) {
      let raw: TankerStation = {}
      try {
        raw = row.raw_json ? (JSON.parse(row.raw_json) as TankerStation) : {}
      } catch {
        raw = {}
      }
      const picked = { ...raw, id: row.provider_station_id }
      return normalizeFromPick(sid, picked, row.fetched_at ?? nowIso(), 'Preise konnten nicht aktualisiert werden. Es werden zuletzt gespeicherte Preise angezeigt.')
    }
    return { ok: false, configured: true, message: 'Spritpreise konnten nicht aktualisiert werden.' }
  }
}
