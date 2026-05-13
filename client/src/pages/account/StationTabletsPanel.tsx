import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Plus } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../../context/auth-context'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

type TabletApiRow = {
  id: string
  stationId: string
  stationName: string
  name: string
  description: string | null
  tokenTail: string | null
  isActive: boolean
  firstSeenAt: string | null
  lastSeenAt: string | null
  lastIp: string | null
  userAgent: string | null
  createdAt: string | null
  updatedAt: string | null
  revokedAt: string | null
}

function formatDeDt(iso?: string | null): string {
  if (!iso?.trim()) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const y = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${mo}.${y}, ${h}:${mi} Uhr`
}

function buildTabletUrl(tabletToken: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/tablet/${encodeURIComponent(tabletToken)}`
}

type Props = {
  canView: boolean
  canManage: boolean
}

/** Merkt Tokens nur in dieser Browser-Session (Nachricht bei neuem Gerät nur über „Token neu“). */
const tokenMemory = (): Map<string, string> =>
  typeof window !== 'undefined' &&
  '__stationTabletKnownTokens' in window &&
  (window as Window & { __stationTabletKnownTokens?: Map<string, string> }).__stationTabletKnownTokens
    ? (window as Window & { __stationTabletKnownTokens?: Map<string, string> }).__stationTabletKnownTokens!
    : ((): Map<string, string> => {
        const m = new Map<string, string>()
        if (typeof window !== 'undefined') {
          ;(window as Window & { __stationTabletKnownTokens?: Map<string, string> }).__stationTabletKnownTokens = m
        }
        return m
      })()

export function StationTabletsPanel({ canView, canManage }: Props) {
  const { user } = useAuth()
  const { stationId, availableStations, canSwitchStation, setSelectedStationId } = useStation()

  const [rows, setRows] = useState<TabletApiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formStationId, setFormStationId] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const [tokenReveal, setTokenReveal] = useState<{ tabletToken: string; label: string } | null>(null)

  const [editOpen, setEditOpen] = useState<TabletApiRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmRegen, setConfirmRegen] = useState<TabletApiRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TabletApiRow | null>(null)

  const load = useCallback(async () => {
    if (!stationId || !canView) {
      setRows([])
      return
    }
    setLoading(true)
    setErr(null)
    const res = await apiGet<TabletApiRow[]>('/station-tablets', { stationId })
    if (res.ok && Array.isArray(res.data)) setRows(res.data)
    else setErr(res.ok === false ? res.error : 'Daten konnten nicht geladen werden.')
    setLoading(false)
  }, [stationId, canView])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (addOpen && stationId) setFormStationId(stationId)
  }, [addOpen, stationId])

  const stationOptions = useMemo(() => {
    return availableStations.map((s) => ({ id: s.id, name: s.name }))
  }, [availableStations])

  const rememberToken = useCallback((deviceId: string, tabletToken: string) => {
    tokenMemory().set(deviceId, tabletToken)
  }, [])

  const getKnownToken = (deviceId: string) => tokenMemory().get(deviceId)

  const submitAdd = async () => {
    if (!canManage) return
    const sid = formStationId.trim() || stationId
    if (!sid) return
    setCreating(true)
    setErr(null)
    try {
      const res = await apiSend<{ device: TabletApiRow; tabletToken: string }>('POST', '/station-tablets', {
        stationId: sid,
        name: formName.trim(),
        description: formDesc.trim() || undefined,
      })
      if (!res.ok) throw new Error(res.error)
      setAddOpen(false)
      setFormName('')
      setFormDesc('')
      if (sid !== stationId && canSwitchStation) setSelectedStationId(sid)
      await load()
      if (res.data?.tabletToken && res.data.device?.id) {
        rememberToken(res.data.device.id, res.data.tabletToken)
        setTokenReveal({ tabletToken: res.data.tabletToken, label: res.data.device?.name ?? formName.trim() })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen')
    } finally {
      setCreating(false)
    }
  }

  const runBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setErr(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Aktion fehlgeschlagen')
    } finally {
      setBusyId(null)
    }
  }

  const copyLink = async (tabletToken: string) => {
    const url = buildTabletUrl(tabletToken)
    try {
      await navigator.clipboard.writeText(url)
      window.alert('Link kopiert.')
    } catch {
      window.prompt('Link kopieren', url)
    }
  }

  const downloadQrFromCanvas = (fileBase: string) => {
    const el = document.getElementById('station-tablet-qr-download')
    if (!el || !(el instanceof HTMLCanvasElement)) return
    const png = el.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = png
    a.download = `tablet-qr_${fileBase.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 48)}.png`
    a.click()
  }

  const showQrIfKnown = (r: TabletApiRow) => {
    const t = getKnownToken(r.id)
    if (!t || !r.isActive) {
      window.alert('QR-Link ist nur nach dem Erstellen oder nach „Token neu“ in diesem Browser verfügbar. Bitte „Token neu“ wählen.')
      return
    }
    setTokenReveal({ tabletToken: t, label: r.name })
  }

  if (!canView) return null

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--text-main)]">Stations-Tablets</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Hier werden Tablets verwaltet, die an der Station für Mitarbeiter-Check-in, Check-out, Aufgaben und Schichtplan
          genutzt werden. Anders als die{' '}
          <span className="text-[var(--text-main)]">Mitarbeiter-App am Handy</span> ist jedes Stations-Tablet an die
          Tankstelle gebunden — Mitarbeitende melden sich per Kassennummer, ohne persönlichen App-Login.
        </p>
      </div>

      {canManage ? (
        <Button type="button" variant="primary" className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Stations-Tablet hinzufügen
        </Button>
      ) : null}

      {err ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade Tablets…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Noch kein Stations-Tablet eingerichtet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)]/80 p-4 text-sm shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text-main)]">{r.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">Station: {r.stationName}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium ${r.isActive ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {r.isActive ? 'Aktiv' : 'Deaktiviert'}
                </span>
              </div>
              {r.description ? <p className="mt-2 text-xs text-[var(--text-muted)]">{r.description}</p> : null}
              <dl className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                <div className="flex justify-between gap-2">
                  <dt>Token</dt>
                  <dd className="font-mono text-[var(--text-faint)]">{r.tokenTail ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Zuletzt genutzt</dt>
                  <dd>{r.lastSeenAt ? formatDeDt(r.lastSeenAt) : 'Noch nie'}</dd>
                </div>
                {user?.globalAdmin && r.userAgent ? (
                  <div className="pt-1 text-[10px] text-slate-500">
                    UA: {r.userAgent.slice(0, 120)}
                    {r.userAgent.length > 120 ? '…' : ''}
                  </div>
                ) : null}
              </dl>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[10px] px-2 py-1"
                    disabled={!r.isActive}
                    onClick={() => showQrIfKnown(r)}
                  >
                    QR-Code anzeigen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[10px] px-2 py-1"
                    disabled={!r.isActive || !getKnownToken(r.id)}
                    onClick={() => {
                      const t = getKnownToken(r.id)
                      if (t) void copyLink(t)
                    }}
                  >
                    Link kopieren
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[10px] px-2 py-1"
                    disabled={!r.isActive || busyId === r.id}
                    onClick={() => setConfirmRegen(r)}
                  >
                    Token neu
                  </Button>
                  {r.isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-[10px] px-2 py-1"
                      disabled={busyId === r.id}
                      onClick={() =>
                        void runBusy(r.id, async () => {
                          const res = await apiSend('POST', `/station-tablets/${encodeURIComponent(r.id)}/disable`, {
                            stationId: r.stationId,
                          })
                          if (!res.ok) throw new Error(res.error)
                        })
                      }
                    >
                      Deaktivieren
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      className="text-[10px] px-2 py-1"
                      disabled={busyId === r.id}
                      onClick={() =>
                        void runBusy(r.id, async () => {
                          const res = await apiSend('POST', `/station-tablets/${encodeURIComponent(r.id)}/enable`, {
                            stationId: r.stationId,
                          })
                          if (!res.ok) throw new Error(res.error)
                        })
                      }
                    >
                      Aktivieren
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[10px] px-2 py-1"
                    onClick={() => {
                      setEditOpen(r)
                      setEditName(r.name)
                      setEditDesc(r.description ?? '')
                    }}
                  >
                    Bearbeiten
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-[10px] px-2 py-1 text-rose-200/90"
                    disabled={busyId === r.id}
                    onClick={() => setConfirmDelete(r)}
                  >
                    Löschen
                  </Button>
                </div>
              ) : null}
              {canManage ? (
                <p className="mt-2 text-[10px] text-[var(--text-faint)]">
                  Nach „Token neu“ oder Erstellung speichern wir den Zugangs-Link nur in diesem Browser‑Tab zum
                  Anzeigen/Speichern des QR-Codes — nicht auf dem Server nachlesbar.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {addOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Stations-Tablet hinzufügen</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-[var(--text-muted)]">
                Gerätename
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
                  placeholder="z. B. Tablet Kasse"
                />
              </label>
              <label className="block text-sm text-[var(--text-muted)]">
                Station
                <select
                  value={formStationId || stationId || ''}
                  onChange={(e) => setFormStationId(e.target.value)}
                  disabled={!(canSwitchStation || user?.globalAdmin)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)] disabled:opacity-60"
                >
                  {stationOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-[var(--text-muted)]">
                Beschreibung (optional)
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={creating || !formName.trim()}
                onClick={() => void submitAdd()}
              >
                Tablet-Zugang erstellen
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">Tablet bearbeiten</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-[var(--text-muted)]">
                Gerätename
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
                />
              </label>
              <label className="block text-sm text-[var(--text-muted)]">
                Beschreibung
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[var(--text-main)]"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={busyId === editOpen.id || !editName.trim()}
                onClick={() =>
                  void runBusy(editOpen.id, async () => {
                    const res = await apiSend('PUT', `/station-tablets/${encodeURIComponent(editOpen.id)}`, {
                      stationId: editOpen.stationId,
                      name: editName.trim(),
                      description: editDesc.trim(),
                    })
                    if (!res.ok) throw new Error(res.error)
                    setEditOpen(null)
                  })
                }
              >
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tokenReveal ? (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-cyan-500/25 bg-[var(--bg-card)] p-5 text-center">
            <h3 className="text-lg font-semibold text-[var(--text-main)]">QR-Code &amp; Link</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{tokenReveal.label}</p>
            <p className="mt-3 text-xs text-cyan-200/90">
              Scanne diesen QR-Code mit dem Stations-Tablet, um den Terminal-Modus zu öffnen.
            </p>
            <div className="mt-4 flex justify-center">
              <QRCodeCanvas
                value={buildTabletUrl(tokenReveal.tabletToken)}
                size={220}
                level="M"
                includeMargin
                id="station-tablet-qr-download"
              />
            </div>
            <p className="mt-3 break-all text-[10px] text-[var(--text-faint)]">{buildTabletUrl(tokenReveal.tabletToken)}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => void copyLink(tokenReveal.tabletToken)}>
                <Copy className="h-4 w-4" aria-hidden />
                Link kopieren
              </Button>
              <Button type="button" variant="outline" onClick={() => downloadQrFromCanvas(tokenReveal.label)}>
                QR herunterladen
              </Button>
              <Button type="button" variant="ghost" onClick={() => setTokenReveal(null)}>
                Schließen
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmRegen)}
        title="Tablet-Token neu erzeugen?"
        message="Der alte QR-Code funktioniert danach nicht mehr. Die Leitung muss den neuen Code erneut auf dem Tablet hinterlegen."
        cancelLabel="Abbrechen"
        confirmLabel="Neu erzeugen"
        variant="primary"
        onCancel={() => setConfirmRegen(null)}
        onConfirm={() => {
          const r = confirmRegen
          setConfirmRegen(null)
          if (!r) return
          void (async () => {
            setBusyId(r.id)
            setErr(null)
            try {
              const res = await apiSend<{ tabletToken: string }>(
                'POST',
                `/station-tablets/${encodeURIComponent(r.id)}/regenerate-token`,
                { stationId: r.stationId },
              )
              if (!res.ok) throw new Error(res.error)
              if (res.data?.tabletToken) {
                rememberToken(r.id, res.data.tabletToken)
                setTokenReveal({ tabletToken: res.data.tabletToken, label: r.name })
              }
              await load()
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Fehler')
            } finally {
              setBusyId(null)
            }
          })()
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Stations-Tablet löschen?"
        message="Wurde das Gerät schon genutzt, wird es nur deaktiviert. Ohne Nutzung wird der Eintrag entfernt."
        cancelLabel="Abbrechen"
        confirmLabel="Löschen"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const r = confirmDelete
          setConfirmDelete(null)
          if (!r) return
          void runBusy(r.id, async () => {
            const res = await apiSend<{ ok?: boolean }>(
              'DELETE',
              `/station-tablets/${encodeURIComponent(r.id)}`,
              undefined,
              { stationId: r.stationId },
            )
            if (!res.ok) throw new Error(res.error)
            tokenMemory().delete(r.id)
          })
        }}
      />
    </section>
  )
}
