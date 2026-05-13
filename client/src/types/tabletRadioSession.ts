/** Radio-Konfiguration aus Tablet-Session (pro Station), siehe GET /api/tablet/session/:token */
export type TabletRadioConfig = {
  enabled: boolean
  streamName: string | null
  streamUrl: string | null
  streamUrlFallback: string | null
  defaultVolume: number
  defaultPresetId: string | null
}
