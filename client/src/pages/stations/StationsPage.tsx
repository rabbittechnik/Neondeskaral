import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, Clock, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import { useStation } from '../../context/station-context'
import { apiGet, apiSend } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import type { AuthUser } from '../../context/auth-context'

type StationApiRow = {
  id: string
  name: string
  brand?: string | null
  address?: string | null
  street?: string | null
  house_number?: string | null
  postal_code?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  contact_person?: string | null
  notes?: string | null
  tankerkoenig_station_id?: string | null
  federal_state?: string | null
  standard_work_times_json?: string | null
  active?: number | null
  deleted_at?: string | null
  archived_at?: string | null
  employeeCount?: number
  openShiftsCount?: number
  hasHistoricalData?: boolean
}

type WorkTimeSlot = { start: string; end: string }
type StandardWorkTimes = {
  early?: WorkTimeSlot
  late?: WorkTimeSlot
  night?: WorkTimeSlot
  holiday?: WorkTimeSlot
}

function userCanOpenStationsPage(user: AuthUser | null): boolean {
  if (!user) return false
  if (user.globalAdmin) return true
  return (
    user.stationAccess?.some(
      (a) => a.permissions['stations.manage'] === true || a.permissions['station.profile.edit'] === true,
    ) ?? false
  )
}

function seesFullDirectory(user: AuthUser | null): boolean {
  if (!user) return false
  if (user.globalAdmin) return true
  return user.stationAccess?.some((a) => a.permissions['stations.manage'] === true) ?? false
}

function canEditStationRow(user: AuthUser | null, stationId: string): boolean {
  if (!user) return false
  if (seesFullDirectory(user)) return true
  return (
    user.stationAccess?.some(
      (a) => a.stationId === stationId && a.permissions['station.profile.edit'] === true,
    ) ?? false
  )
}

function displayOrPlaceholder(value: string | null | undefined): string {
  const t = String(value ?? '').trim()
  return t || 'Noch nicht hinterlegt'
}

function formatStreetLine(row: StationApiRow): string {
  const st = String(row.street ?? '').trim()
  const hn = String(row.house_number ?? '').trim()
  const line = [st, hn].filter(Boolean).join(' ').trim()
  if (line) return line
  const legacy = String(row.address ?? '').trim()
  return legacy || ''
}

function formatCityLine(row: StationApiRow): string {
  const plz = String(row.postal_code ?? '').trim()
  const city = String(row.city ?? '').trim()
  const line = [plz, city].filter(Boolean).join(' ').trim()
  return line
}

function parseWorkTimes(json: string | null | undefined): StandardWorkTimes {
  if (!json || !json.trim()) return {}
  try {
    return JSON.parse(json) as StandardWorkTimes
  } catch {
    return {}
  }
}

function emptyForm(): {
  name: string
  brand: string
  street: string
  houseNumber: string
  postalCode: string
  city: string
  phone: string
  email: string
  contactPerson: string
  tankerkoenigStationId: string
  notes: string
  federalState: string
  active: boolean
} {
  return {
    name: '',
    brand: '',
    street: '',
    houseNumber: '',
    postalCode: '',
    city: '',
    phone: '',
    email: '',
    contactPerson: '',
    tankerkoenigStationId: '',
    notes: '',
    federalState: 'BW',
    active: true,
  }
}

function rowToForm(row: StationApiRow) {
  return {
    name: String(row.name ?? ''),
    brand: String(row.brand ?? ''),
    street: String(row.street ?? ''),
    houseNumber: String(row.house_number ?? ''),
    postalCode: String(row.postal_code ?? ''),
    city: String(row.city ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    contactPerson: String(row.contact_person ?? ''),
    tankerkoenigStationId: String(row.tankerkoenig_station_id ?? ''),
    notes: String(row.notes ?? ''),
    federalState: String(row.federal_state ?? 'BW'),
    active: (row.active ?? 1) !== 0,
  }
}

export function StationsPage() {
  const { user, refreshMe } = useAuth()
  const { setSelectedStationId } = useStation()
  const navigate = useNavigate()
  const [rows, setRows] = useState<StationApiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [editModal, setEditModal] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(() => emptyForm())
  const [saveBusy, setSaveBusy] = useState(false)

  const [timesModalStation, setTimesModalStation] = useState<StationApiRow | null>(null)
  const [workTimes, setWorkTimes] = useState<StandardWorkTimes>({})
  const [timesBusy, setTimesBusy] = useState(false)

  const fullDir = seesFullDirectory(user)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const q: Record<string, string | undefined> = { includeCounts: 'true' }
    if (fullDir && includeArchived) q.includeArchived = 'true'
    const res = await apiGet<StationApiRow[]>('/stations', q)
    if (!res.ok) {
      setError(res.error)
      setRows([])
    } else {
      setRows(res.data)
    }
    setLoading(false)
  }, [fullDir, includeArchived])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 9000)
    return () => window.clearTimeout(t)
  }, [notice])

  const openCreate = () => {
    setForm(emptyForm())
    setEditId(null)
    setEditModal('create')
  }

  const openEdit = (row: StationApiRow) => {
    if (!canEditStationRow(user, row.id)) return
    setEditId(row.id)
    setForm(rowToForm(row))
    setEditModal('edit')
  }

  const saveStation = async () => {
    const name = form.name.trim()
    if (!name) {
      setError('Stationsname ist erforderlich.')
      return
    }
    setSaveBusy(true)
    setError(null)
    const body = {
      name,
      brand: form.brand.trim() || null,
      street: form.street.trim() || null,
      houseNumber: form.houseNumber.trim() || null,
      postalCode: form.postalCode.trim() || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      contactPerson: form.contactPerson.trim() || null,
      notes: form.notes.trim() || null,
      tankerkoenigStationId: form.tankerkoenigStationId.trim() || null,
      federalState: form.federalState.trim() || 'BW',
      ...(fullDir ? { active: form.active } : {}),
    }
    const res =
      editModal === 'create'
        ? await apiSend<StationApiRow>('POST', '/stations', body)
        : await apiSend<StationApiRow>('PUT', `/stations/${editId}`, body)
    setSaveBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditModal('closed')
    setNotice(editModal === 'create' ? 'Station angelegt.' : 'Gespeichert.')
    await refreshMe()
    await load()
  }

  const openTimes = (row: StationApiRow) => {
    if (!canEditStationRow(user, row.id)) return
    setTimesModalStation(row)
    setWorkTimes(parseWorkTimes(row.standard_work_times_json))
  }

  const saveTimes = async () => {
    if (!timesModalStation) return
    setTimesBusy(true)
    const json = JSON.stringify(workTimes)
    const res = await apiSend<unknown>('PUT', `/stations/${timesModalStation.id}`, {
      standardWorkTimesJson: json,
    })
    setTimesBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setTimesModalStation(null)
    setNotice('Standardarbeitszeiten gespeichert.')
    await load()
  }

  const archiveOne = async (row: StationApiRow) => {
    if (!fullDir) return
    if (!window.confirm(`Station „${row.name}“ deaktivieren und aus dem Stationswechsel ausblenden?`)) return
    const res = await apiSend<{ archived?: boolean }>('POST', `/stations/${row.id}/archive`, {})
    if (!res.ok) {
      setError(res.error)
      return
    }
    setNotice('Station deaktiviert.')
    await refreshMe()
    await load()
  }

  const restoreOne = async (row: StationApiRow) => {
    if (!fullDir) return
    const res = await apiSend<{ restored?: boolean }>('POST', `/stations/${row.id}/restore`, {})
    if (!res.ok) {
      setError(res.error)
      return
    }
    setNotice('Station wiederhergestellt.')
    await refreshMe()
    await load()
  }

  const deleteOne = async (row: StationApiRow) => {
    if (!fullDir) return
    if (!window.confirm(`Station „${row.name}“ löschen? Ohne Historie wird sie endgültig entfernt.`)) return
    const res = await apiSend<{ mode?: string; message?: string }>('DELETE', `/stations/${row.id}`)
    if (!res.ok) {
      setError(res.error)
      return
    }
    if (res.ok && res.data?.mode === 'archived' && res.data.message) {
      setNotice(res.data.message)
    } else {
      setNotice('Station gelöscht.')
    }
    await refreshMe()
    await load()
  }

  const openStation = (row: StationApiRow) => {
    const del = String(row.deleted_at ?? '').trim()
    const active = (row.active ?? 1) !== 0
    if (!active || del) {
      setError('Diese Station ist deaktiviert. Bitte zuerst wiederherstellen oder eine andere Station wählen.')
      return
    }
    setSelectedStationId(row.id)
    navigate('/dashboard')
  }

  function renderWorkTimeSlot(key: keyof StandardWorkTimes, label: string) {
    const s = workTimes[key] ?? { start: '', end: '' }
    return (
      <div key={String(key)} className="grid gap-2 sm:grid-cols-3 sm:items-end">
        <p className="text-sm font-medium text-[var(--text-main)] sm:col-span-1">{label}</p>
        <label className="text-xs text-[var(--text-muted)]">
          Beginn
          <input
            type="time"
            value={s.start}
            onChange={(e) =>
              setWorkTimes((w) => ({
                ...w,
                [key]: { ...s, start: e.target.value },
              }))
            }
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
        <label className="text-xs text-[var(--text-muted)]">
          Ende
          <input
            type="time"
            value={s.end}
            onChange={(e) =>
              setWorkTimes((w) => ({
                ...w,
                [key]: { ...s, end: e.target.value },
              }))
            }
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-2 text-sm text-[var(--text-main)]"
          />
        </label>
      </div>
    )
  }

  if (!userCanOpenStationsPage(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Stationen verwalten"
        description="Stammdaten, Standardzeiten und Tankerkönig-Anbindung pro Tankstelle. Persönliches Benutzerkonto bleibt unter „Mein Konto → Profil“."
        actions={
          fullDir ? (
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Station hinzufügen
            </Button>
          ) : null
        }
      />

      {notice ? (
        <div className="rounded-[var(--radius-md)] border border-cyan-400/35 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {fullDir ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-[var(--border-subtle)] bg-[var(--bg-card)]"
          />
          Archivierte / deaktivierte Stationen anzeigen
        </label>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade Stationen…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => {
            const streetLine = formatStreetLine(row)
            const cityLine = formatCityLine(row)
            const del = String(row.deleted_at ?? '').trim()
            const active = (row.active ?? 1) !== 0
            const archived = Boolean(del) || !active
            const emp = row.employeeCount ?? 0
            const openSh = row.openShiftsCount ?? 0
            const canEdit = canEditStationRow(user, row.id)
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-gradient-to-br from-cyan-400/20 to-fuchsia-500/15 ring-1 ring-cyan-400/30">
                      <Building2 className="h-5 w-5 text-cyan-200" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-[var(--text-main)]">{row.name}</h2>
                      <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300/90">
                        {displayOrPlaceholder(row.brand)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      archived
                        ? 'bg-white/5 text-[var(--text-muted)] ring-1 ring-white/10'
                        : 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30'
                    }`}
                  >
                    {archived ? 'Inaktiv' : 'Aktiv'}
                  </span>
                </div>

                <dl className="relative mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Adresse</dt>
                    <dd className="text-[var(--text-main)]">
                      {streetLine || displayOrPlaceholder('')}
                      {cityLine ? (
                        <>
                          <br />
                          {cityLine}
                        </>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Telefon</dt>
                    <dd className="text-[var(--text-main)]">{displayOrPlaceholder(row.phone)}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>Mitarbeitende: {emp}</span>
                    <span>Offene Schichten (unveröffentlicht/künftig): {openSh}</span>
                  </div>
                </dl>

                <div className="relative mt-5 flex flex-wrap gap-2">
                  {canEdit ? (
                    <Button
                      variant="outline"
                      className="px-3 py-1.5 text-xs"
                      leftIcon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openEdit(row)}
                    >
                      Bearbeiten
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    leftIcon={<ChevronRight className="h-3.5 w-3.5" />}
                    onClick={() => openStation(row)}
                  >
                    Öffnen
                  </Button>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      leftIcon={<Clock className="h-3.5 w-3.5" />}
                      onClick={() => openTimes(row)}
                    >
                      Standardzeiten
                    </Button>
                  ) : null}
                  {fullDir && !archived ? (
                    <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => archiveOne(row)}>
                      Deaktivieren
                    </Button>
                  ) : null}
                  {fullDir && archived ? (
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                      onClick={() => restoreOne(row)}
                    >
                      Wiederherstellen
                    </Button>
                  ) : null}
                  {fullDir ? (
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs text-red-300 hover:text-red-200"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => deleteOne(row)}
                    >
                      Löschen
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editModal !== 'closed' ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]"
            role="dialog"
            aria-labelledby="station-form-title"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="station-form-title" className="text-lg font-semibold text-[var(--text-main)]">
                {editModal === 'create' ? 'Neue Station anlegen' : 'Station bearbeiten'}
              </h2>
              <button
                type="button"
                className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]"
                aria-label="Schließen"
                onClick={() => setEditModal('closed')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {(
                [
                  ['name', 'Stationsname', 'text', true],
                  ['brand', 'Marke', 'text', false],
                  ['street', 'Straße', 'text', false],
                  ['houseNumber', 'Hausnummer', 'text', false],
                  ['postalCode', 'PLZ', 'text', false],
                  ['city', 'Ort', 'text', false],
                  ['phone', 'Telefonnummer', 'text', false],
                  ['email', 'E-Mail', 'email', false],
                  ['contactPerson', 'Ansprechpartner', 'text', false],
                  ['tankerkoenigStationId', 'Tankerkönig Stations-ID', 'text', false],
                  ['notes', 'Notizen', 'textarea', false],
                ] as const
              ).map(([key, label, type, required]) => (
                <label key={key} className="block text-xs font-medium text-[var(--text-muted)]">
                  {label}
                  {required ? <span className="text-red-300"> *</span> : null}
                  {type === 'textarea' ? (
                    <textarea
                      value={form[key as keyof typeof form] as string}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      rows={3}
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-main)]"
                    />
                  ) : (
                    <input
                      type={type}
                      value={form[key as keyof typeof form] as string}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-main)]"
                    />
                  )}
                </label>
              ))}

              <label className="block text-xs font-medium text-[var(--text-muted)]">
                Bundesland (Feiertage)
                <select
                  value={form.federalState}
                  onChange={(e) => setForm((f) => ({ ...f, federalState: e.target.value }))}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-main)]"
                >
                  {['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </select>
              </label>

              {fullDir && editModal === 'edit' ? (
                <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="rounded border-[var(--border-subtle)] bg-[var(--bg-main)]"
                  />
                  Station aktiv
                </label>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditModal('closed')} disabled={saveBusy}>
                Abbrechen
              </Button>
              <Button variant="primary" onClick={() => void saveStation()} disabled={saveBusy}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {timesModalStation ? (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-main)]">Standardarbeitszeiten</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{timesModalStation.name}</p>
              </div>
              <button
                type="button"
                className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] hover:bg-white/5"
                aria-label="Schließen"
                onClick={() => setTimesModalStation(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!timesModalStation.standard_work_times_json?.trim() &&
            !Object.keys(workTimes).some((k) => workTimes[k as keyof StandardWorkTimes]) ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Für diese Station sind noch keine Standardarbeitszeiten hinterlegt.
              </p>
            ) : null}

            <div className="mt-5 space-y-4">
              {renderWorkTimeSlot('early', 'Früh')}
              {renderWorkTimeSlot('late', 'Spät')}
              {renderWorkTimeSlot('night', 'Nacht')}
              {renderWorkTimeSlot('holiday', 'Feiertag / Sonder')}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTimesModalStation(null)} disabled={timesBusy}>
                Abbrechen
              </Button>
              <Button variant="primary" onClick={() => void saveTimes()} disabled={timesBusy}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
