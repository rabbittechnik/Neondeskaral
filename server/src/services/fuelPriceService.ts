import type { Database } from 'better-sqlite3'
import { nowIso } from '../utils/timestamps.js'
import { getStation } from './stationService.js'

const PRICES_URL = 'https://creativecommons.tankerkoenig.de/json/prices.php'

/** Mindestabstand zwischen echten Tankerkönig-HTTP-Aufrufen pro Station (API-Limit ~1/min). */
export const TANKERKOENIG_MIN_INTERVAL_MS = 60_000

type TankerStation = Record<string, unknown>

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

export function tankerkoenigPricesUrl(ids: string, apiKey: string): string {
  const u = new URL(PRICES_URL)
  u.searchParams.set('ids', ids)
  u.searchParams.set('apikey', apiKey)
  return u.toString()
}

type CacheRow = {
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
  last_tankerkoenig_fetch_at: string | null
}

function readCacheRow(db: Database, stationId: string): CacheRow | undefined {
  const id = cacheRowId(stationId)
  return db.prepare(`SELECT * FROM fuel_price_cache WHERE id = ?`).get(id) as CacheRow | undefined
}

function cacheRowId(stationId: string) {
  return `tankerkoenig-${stationId}`
}

function cacheAgeMs(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return Date.now() - t
}

function stationDisplayFromDb(st: Record<string, unknown>) {
  return {
    name: str(st.name) || 'Tankstelle',
    brand: str(st.brand),
    street: str(st.street),
    houseNumber: str(st.house_number),
    postCode: str(st.postal_code),
    place: str(st.city),
  }
}

export type FuelPricesCurrentOk = {
  ok: true
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
  fetchedAt: string
  fromCache: boolean
  currency: 'EUR'
  source: string
  cacheWarning?: string
  /** z. B. bei „Jetzt aktualisieren“ innerhalb von 60 s nach letztem TK-Aufruf */
  infoMessage?: string
}

export type FuelPricesCurrentErr = {
  ok: false
  stationId: string
  configured: boolean
  message: string
  cacheWarning?: string
}

export type FuelPricesCurrentResponse = FuelPricesCurrentOk | FuelPricesCurrentErr

function successPayload(
  stationId: string,
  tkId: string,
  stationBlock: FuelPricesCurrentOk['station'],
  prices: { diesel: number; e5: number; e10: number },
  isOpen: boolean,
  fetchedAt: string,
  fromCache: boolean,
  extra?: { cacheWarning?: string; infoMessage?: string },
): FuelPricesCurrentOk {
  return {
    ok: true,
    stationId,
    providerStationId: tkId,
    station: stationBlock,
    prices,
    isOpen,
    fetchedAt,
    fromCache,
    currency: 'EUR',
    source: 'Tankerkönig / MTS-K',
    ...(extra?.cacheWarning ? { cacheWarning: extra.cacheWarning } : {}),
    ...(extra?.infoMessage ? { infoMessage: extra.infoMessage } : {}),
  }
}

/** Verhindert zu häufige TK-Retries bei Fehlern (zählt als „letzter API-Versuch“). */
function markTankerkoenigFetchAttempt(db: Database, stationId: string, ts: string) {
  const id = cacheRowId(stationId)
  db.prepare(
    `INSERT INTO fuel_price_cache (id, station_id, provider, last_tankerkoenig_fetch_at, created_at, updated_at)
     VALUES (?, ?, 'tankerkoenig', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_tankerkoenig_fetch_at = excluded.last_tankerkoenig_fetch_at,
       updated_at = excluded.updated_at`,
  ).run(id, stationId, ts, ts, ts)
}

function persistCache(
  db: Database,
  stationId: string,
  tkStationId: string,
  picked: TankerStation,
  diesel: number,
  e5: number,
  e10: number,
  isOpen: boolean,
  rawJson: string,
  liveFetchAt: string,
) {
  const ts = nowIso()
  const id = cacheRowId(stationId)
  db.prepare(
    `INSERT INTO fuel_price_cache (
      id, station_id, provider, provider_station_id, status, is_open, e5, e10, diesel, currency, raw_json, fetched_at, last_tankerkoenig_fetch_at, created_at, updated_at
    ) VALUES (?, ?, 'tankerkoenig', ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider_station_id = excluded.provider_station_id,
      status = excluded.status,
      is_open = excluded.is_open,
      e5 = excluded.e5,
      e10 = excluded.e10,
      diesel = excluded.diesel,
      raw_json = excluded.raw_json,
      fetched_at = excluded.fetched_at,
      last_tankerkoenig_fetch_at = excluded.last_tankerkoenig_fetch_at,
      updated_at = excluded.updated_at`,
  ).run(
    id,
    stationId,
    tkStationId,
    isOpen ? 'open' : 'closed',
    isOpen ? 1 : 0,
    e5,
    e10,
    diesel,
    rawJson,
    liveFetchAt,
    liveFetchAt,
    ts,
    ts,
  )
}

async function fetchPricesLive(tkStationId: string, apiKey: string): Promise<{
  ok: boolean
  priceBlock: TankerStation | null
  rawText: string
}> {
  const url = tankerkoenigPricesUrl(tkStationId, apiKey)
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  const rawText = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(rawText) as Record<string, unknown>
  } catch {
    return { ok: false, priceBlock: null, rawText }
  }
  if (json.ok === false) {
    return { ok: false, priceBlock: null, rawText }
  }
  const pricesRoot = json.prices
  if (!pricesRoot || typeof pricesRoot !== 'object') return { ok: false, priceBlock: null, rawText }
  const block = (pricesRoot as Record<string, unknown>)[tkStationId]
  if (!block || typeof block !== 'object') return { ok: false, priceBlock: null, rawText }
  return { ok: true, priceBlock: block as TankerStation, rawText }
}

function buildFromCacheRow(
  dbStationId: string,
  tkId: string,
  row: CacheRow,
  stationBlock: FuelPricesCurrentOk['station'],
  fromCache: boolean,
  extra?: { cacheWarning?: string; infoMessage?: string },
): FuelPricesCurrentOk | null {
  if (row.e5 == null || row.e10 == null || row.diesel == null) return null
  let raw: TankerStation = {}
  try {
    raw = row.raw_json ? (JSON.parse(row.raw_json) as TankerStation) : {}
  } catch {
    raw = {}
  }
  const isOpen = row.is_open === 1 || str(raw.status) === 'open' || str(row.status) === 'open'
  return successPayload(
    dbStationId,
    tkId,
    stationBlock,
    { diesel: row.diesel, e5: row.e5, e10: row.e10 },
    isOpen,
    row.fetched_at ?? nowIso(),
    fromCache,
    extra,
  )
}

const inflightByStation = new Map<string, Promise<FuelPricesCurrentResponse>>()

export async function getFuelPricesCurrent(
  db: Database,
  stationId: string,
  opts?: { forceRefresh?: boolean },
): Promise<FuelPricesCurrentResponse> {
  const sid = String(stationId ?? '').trim()
  if (!sid) {
    return { ok: false, stationId: '', configured: false, message: 'Keine Station angegeben.' }
  }

  if (inflightByStation.has(sid)) {
    return inflightByStation.get(sid)!
  }

  const run = (async (): Promise<FuelPricesCurrentResponse> => {
    const stRow = getStation(db, sid)
    if (!stRow) {
      return { ok: false, stationId: sid, configured: false, message: 'Station nicht gefunden.' }
    }

    const tkId = str(stRow.tankerkoenig_station_id)
    const stationBlock = stationDisplayFromDb(stRow)
    const apiKey = String(process.env.TANKERKOENIG_API_KEY ?? '').trim()

    if (!apiKey) {
      return {
        ok: false,
        stationId: sid,
        configured: false,
        message: 'Tankerkönig API-Key ist nicht konfiguriert (nur serverseitig, z. B. TANKERKOENIG_API_KEY in Railway).',
      }
    }

    if (!tkId) {
      const row = readCacheRow(db, sid)
      if (row && row.e5 != null && row.e10 != null && row.diesel != null && row.provider_station_id) {
        const built = buildFromCacheRow(sid, str(row.provider_station_id), row, stationBlock, true, {
          cacheWarning:
            'Für diese Station ist noch keine Tankerkönig-ID hinterlegt. Es werden zuletzt gespeicherte Preise angezeigt.',
        })
        if (built) return built
      }
      return {
        ok: false,
        stationId: sid,
        configured: false,
        message: 'Für diese Station ist noch keine Tankerkönig-ID hinterlegt.',
      }
    }

    const row = readCacheRow(db, sid)
    const lastFetchIso = row?.last_tankerkoenig_fetch_at ?? null
    const sinceLastTk = cacheAgeMs(lastFetchIso)
    const withinWindow = lastFetchIso != null && sinceLastTk < TANKERKOENIG_MIN_INTERVAL_MS

    const tryReturnCache = (
      fromCache: boolean,
      infoMessage?: string,
      cacheWarning?: string,
    ): FuelPricesCurrentResponse | null => {
      if (!row || row.e5 == null || row.e10 == null || row.diesel == null) return null
      const pid = str(row.provider_station_id) || tkId
      return buildFromCacheRow(sid, pid, row, stationBlock, fromCache, { infoMessage, cacheWarning })
    }

    if (withinWindow) {
      const info = opts?.forceRefresh ? 'Preise wurden vor wenigen Sekunden aktualisiert.' : undefined
      const cached = tryReturnCache(true, info)
      if (cached) return cached
      return {
        ok: false,
        stationId: sid,
        configured: true,
        message: 'Noch keine gespeicherten Preise. Bitte in Kürze erneut versuchen (Tankerkönig-Limit).',
      }
    }

    const liveFetchStamp = nowIso()
    markTankerkoenigFetchAttempt(db, sid, liveFetchStamp)

    try {
      const live = await fetchPricesLive(tkId, apiKey)
      if (!live.ok || !live.priceBlock) {
        const stale = tryReturnCache(true, undefined, 'Live-Aktualisierung gerade nicht möglich. Letzte bekannte Preise werden angezeigt.')
        if (stale) return stale
        return {
          ok: false,
          stationId: sid,
          configured: true,
          message: 'Spritpreise konnten nicht geladen werden.',
          cacheWarning: 'Tankerkönig lieferte keine Daten für diese Stations-ID.',
        }
      }

      const pb = live.priceBlock
      const diesel = num(pb.diesel)
      const e5 = num(pb.e5)
      const e10 = num(pb.e10)
      if (diesel == null || e5 == null || e10 == null) {
        const stale = tryReturnCache(true, undefined, 'Live-Aktualisierung gerade nicht möglich. Letzte bekannte Preise werden angezeigt.')
        if (stale) return stale
        return { ok: false, stationId: sid, configured: true, message: 'Keine Spritpreise verfügbar.' }
      }

      const isOpen = str(pb.status).toLowerCase() === 'open'
      const merged: TankerStation = {
        id: tkId,
        name: stationBlock.name,
        brand: stationBlock.brand,
        street: stationBlock.street,
        houseNumber: stationBlock.houseNumber,
        house_number: stationBlock.houseNumber,
        postCode: stationBlock.postCode,
        postalCode: stationBlock.postCode,
        place: stationBlock.place,
        diesel,
        e5,
        e10,
        status: pb.status,
        isOpen,
      }
      persistCache(db, sid, tkId, merged, diesel, e5, e10, isOpen, JSON.stringify(merged), liveFetchStamp)

      return successPayload(sid, tkId, stationBlock, { diesel, e5, e10 }, isOpen, liveFetchStamp, false)
    } catch {
      const stale = tryReturnCache(true, undefined, 'Live-Aktualisierung gerade nicht möglich. Letzte bekannte Preise werden angezeigt.')
      if (stale) return stale
      return { ok: false, stationId: sid, configured: true, message: 'Keine Spritpreise verfügbar.' }
    }
  })()

  inflightByStation.set(sid, run)
  try {
    return await run
  } finally {
    inflightByStation.delete(sid)
  }
}

