/**
 * Zentrale Radiosender für das Stations-Tablet (Stream-URLs nur hier pflegen).
 * IDs müssen mit `server/src/constants/tabletRadioPresetIds.ts` übereinstimmen, wo sinnvoll.
 */

export type TabletRadioStation = {
  id: string
  name: string
  streamUrl: string
  /** AAC/MP3-Alternativstream bei Problemen (optional) */
  streamUrlFallback?: string | null
  enabled: boolean
  sortOrder: number
}

/** Sender aus Stations-DB, der nicht in der Standardliste vorkommt */
export const TABLET_RADIO_LEGACY_STATION_ID = '__station_custom__'

export const TABLET_RADIO_STATIONS: TabletRadioStation[] = [
  {
    id: 'bigfm-bw',
    name: 'bigFM Baden-Württemberg',
    streamUrl: 'https://stream.bigfm.de/bw/mp3-128',
    streamUrlFallback: 'https://stream.bigfm.de/bw/aac-128',
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 'swr3',
    name: 'SWR3',
    streamUrl: 'https://dispatcher.rfn.de/swr/swr3/live/swr3.live.lq/mp3/stream.mp3',
    enabled: true,
    sortOrder: 2,
  },
  {
    id: 'swr1-bw',
    name: 'SWR1 Baden-Württemberg',
    streamUrl: 'https://dispatcher.rfn.de/swr/swr1/bw/live/swr1bw.live.lq/mp3/stream.mp3',
    enabled: true,
    sortOrder: 3,
  },
  {
    id: 'dasding',
    name: 'DASDING',
    streamUrl: 'https://dispatcher.rfn.de/swr/dasding/live/dasding.live.lq/mp3/stream.mp3',
    enabled: true,
    sortOrder: 4,
  },
  {
    id: 'antenne1',
    name: 'ANTENNE 1',
    streamUrl: 'https://stream.antenne1.de/a1w/live/mp3/128/stream.mp3',
    enabled: true,
    sortOrder: 5,
  },
  {
    id: 'radio-regenbogen',
    name: 'Radio Regenbogen',
    streamUrl: 'https://stream.regenbogen2.de/live/mp3-128/radioplayer/',
    enabled: true,
    sortOrder: 6,
  },
  {
    id: 'radio7',
    name: 'Radio 7',
    streamUrl: 'https://stream.radio7.de/stream128/mp3/stream.mp3',
    enabled: true,
    sortOrder: 7,
  },
  {
    id: 'energy-stuttgart',
    name: 'ENERGY Stuttgart',
    streamUrl: 'https://energy.sslstream.dlf.de/energy-stuttgart/mp3-128/stream.mp3',
    enabled: true,
    sortOrder: 8,
  },
  {
    id: 'deutschlandfunk',
    name: 'Deutschlandfunk',
    streamUrl: 'https://st01.dlf.de/dlf/01/128/mp3/stream.mp3',
    enabled: true,
    sortOrder: 9,
  },
]

export function listEnabledTabletRadioStations(): TabletRadioStation[] {
  return TABLET_RADIO_STATIONS.filter((s) => s.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getTabletRadioStationById(id: string): TabletRadioStation | undefined {
  return TABLET_RADIO_STATIONS.find((s) => s.id === id)
}

function normUrl(u: string): string {
  return u.trim().toLowerCase().replace(/\/+$/, '')
}

/** Ordnet eine Stream-URL der Preset-ID zu (Legacy-Konfiguration / Server-URL). */
export function findPresetIdByStreamUrl(streamUrl: string | null | undefined): string | null {
  const t = normUrl(String(streamUrl ?? ''))
  if (!t) return null
  for (const s of TABLET_RADIO_STATIONS) {
    if (normUrl(s.streamUrl) === t) return s.id
    const fb = s.streamUrlFallback ? normUrl(s.streamUrlFallback) : ''
    if (fb && fb === t) return s.id
  }
  return null
}

export function buildTabletRadioStationOptions(config: {
  streamName: string | null
  streamUrl: string | null
  streamUrlFallback: string | null
}): TabletRadioStation[] {
  const base = listEnabledTabletRadioStations()
  const legacyUrl = config.streamUrl?.trim()
  if (!legacyUrl) return base
  if (findPresetIdByStreamUrl(legacyUrl)) return base
  const legacy: TabletRadioStation = {
    id: TABLET_RADIO_LEGACY_STATION_ID,
    name: config.streamName?.trim() || 'Stationseinstellung',
    streamUrl: legacyUrl,
    streamUrlFallback: config.streamUrlFallback?.trim() || null,
    enabled: true,
    sortOrder: 0,
  }
  return [legacy, ...base]
}
