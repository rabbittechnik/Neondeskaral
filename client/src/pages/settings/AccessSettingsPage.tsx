import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'

type StationRow = { id: string; name: string }

type ManagedUser = {
  id: string
  username: string
  displayName: string
  globalAdmin: boolean
  active: boolean
  stationAccess: { stationId: string; role: string; permissions: Record<string, boolean> }[]
}

const PERMISSION_UI: { key: string; label: string }[] = [
  { key: 'dashboard.view', label: 'Dashboard ansehen' },
  { key: 'schedule.view', label: 'Schichtplan ansehen' },
  { key: 'schedule.edit', label: 'Schichtplan bearbeiten' },
  { key: 'schedule.create', label: 'Schichten erstellen' },
  { key: 'schedule.delete', label: 'Schichten löschen' },
  { key: 'employees.view', label: 'Mitarbeiter ansehen' },
  { key: 'employees.create', label: 'Mitarbeiter erstellen' },
  { key: 'employees.edit', label: 'Mitarbeiter bearbeiten' },
  { key: 'employees.deactivate', label: 'Mitarbeiter deaktivieren' },
  { key: 'employees.delete', label: 'Mitarbeiter endgültig löschen (ohne Historie)' },
  { key: 'employees.qr', label: 'QR-Codes verwalten' },
  { key: 'employees.viewSensitive', label: 'Sensible Mitarbeiterdaten (PIN/Karte/Entgelt)' },
  { key: 'payroll.view', label: 'Lohn-/Entgeltdaten einsehen' },
  { key: 'employees.manageSensitive', label: 'Sensible Mitarbeiterdaten verwalten' },
  { key: 'absences.view', label: 'Abwesenheiten ansehen' },
  { key: 'absences.create', label: 'Abwesenheiten erstellen' },
  { key: 'absences.approve', label: 'Abwesenheiten genehmigen' },
  { key: 'tasks.view', label: 'Aufgaben ansehen' },
  { key: 'tasks.create', label: 'Aufgaben erstellen' },
  { key: 'tasks.edit', label: 'Aufgaben bearbeiten' },
  { key: 'tasks.control', label: 'Aufgaben kontrollieren' },
  { key: 'time.view', label: 'Zeiterfassung ansehen' },
  { key: 'time.approve', label: 'Zeiten freigeben' },
  { key: 'time.correct', label: 'Zeiten korrigieren' },
  { key: 'settings.view', label: 'Einstellungen ansehen' },
  { key: 'settings.edit', label: 'Einstellungen bearbeiten' },
  { key: 'access.manage', label: 'Benutzer/Zugriffe verwalten' },
  { key: 'tuvReports.view', label: 'TÜV-Berichte ansehen' },
  { key: 'tuvReports.create', label: 'TÜV-Bericht erstellen' },
  { key: 'tuvReports.edit', label: 'TÜV-Bericht bearbeiten' },
  { key: 'tuvReports.complete', label: 'TÜV-Bericht abschließen' },
  { key: 'tuvReports.sign', label: 'TÜV-Bericht unterschreiben/bestätigen' },
  { key: 'tuvReports.print', label: 'TÜV-Bericht drucken' },
  { key: 'tuvReports.manage', label: 'TÜV-Berichte verwalten' },
]

const ROLES = [
  { value: 'stationsleiter', label: 'Stationsleiter' },
  { value: 'teamleiter', label: 'Teamleiter' },
  { value: 'buero', label: 'Büro / Lohn' },
  { value: 'admin_station', label: 'Admin für Station' },
]

function emptyPerms(): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_UI.map((p) => [p.key, false]))
}

export function AccessSettingsPage() {
  const { user, refreshMe } = useAuth()
  if (!user?.globalAdmin) {
    return <Navigate to="/settings/general" replace />
  }

  const [stations, setStations] = useState<StationRow[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formName, setFormName] = useState('')
  const [formUser, setFormUser] = useState('')
  const [formPass, setFormPass] = useState('')
  const [formRole, setFormRole] = useState('teamleiter')
  const [formGlobal, setFormGlobal] = useState(false)
  const [formActive, setFormActive] = useState(true)
  const [formStations, setFormStations] = useState<Set<string>>(() => new Set())
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>(emptyPerms)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const [sRes, uRes] = await Promise.all([
      apiGet<StationRow[]>('/stations'),
      apiGet<ManagedUser[]>('/access/users'),
    ])
    if (sRes.ok && Array.isArray(sRes.data)) setStations(sRes.data.map((r) => ({ id: String(r.id), name: String(r.name) })))
    else setStations([])
    if (uRes.ok && Array.isArray(uRes.data)) setUsers(uRes.data)
    else {
      setUsers([])
      if (!uRes.ok) setErr(uRes.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setFormName('')
    setFormUser('')
    setFormPass('')
    setFormRole('teamleiter')
    setFormGlobal(false)
    setFormActive(true)
    setFormStations(new Set())
    setFormPerms(emptyPerms())
    setModalOpen(true)
  }

  const openEdit = (u: ManagedUser) => {
    setEditingId(u.id)
    setFormName(u.displayName)
    setFormUser(u.username)
    setFormPass('')
    setFormRole(u.stationAccess[0]?.role ?? 'teamleiter')
    setFormGlobal(u.globalAdmin)
    setFormActive(u.active)
    const ids = new Set(u.stationAccess.map((a) => a.stationId))
    setFormStations(ids)
    const merged = emptyPerms()
    const p0 = u.stationAccess[0]?.permissions ?? {}
    for (const k of Object.keys(merged)) merged[k] = Boolean(p0[k])
    setFormPerms(merged)
    setModalOpen(true)
  }

  const toggleStation = (id: string) => {
    setFormStations((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const togglePerm = (key: string) => {
    setFormPerms((p) => ({ ...p, [key]: !p[key] }))
  }

  const save = async () => {
    if (!formGlobal && formStations.size === 0) {
      setErr('Bitte mindestens eine Station auswählen.')
      return
    }
    if (!editingId && !formPass.trim()) {
      setErr('Passwort erforderlich.')
      return
    }
    setSaving(true)
    setErr(null)
    const base = {
      displayName: formName.trim(),
      username: formUser.trim(),
      globalAdmin: formGlobal,
      active: formActive,
      stationIds: [...formStations],
      role: formRole,
      permissions: formPerms,
    }
    const res = editingId
      ? await apiSend<ManagedUser>('PUT', `/access/users/${encodeURIComponent(editingId)}`, {
          ...base,
          ...(formPass.trim() ? { password: formPass } : {}),
        })
      : await apiSend<ManagedUser>('POST', '/access/users', { ...base, password: formPass })
    setSaving(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    setModalOpen(false)
    await load()
    await refreshMe()
  }

  const resetPwd = async (id: string) => {
    const pwd = window.prompt('Neues Passwort (min. 4 Zeichen):')
    if (!pwd || pwd.length < 4) return
    const res = await apiSend('POST', `/access/users/${encodeURIComponent(id)}/reset-password`, { password: pwd })
    if (!res.ok) window.alert(res.error)
    else window.alert('Passwort wurde gesetzt.')
  }

  const stationLabel = useCallback(
    (id: string) => stations.find((s) => s.id === id)?.name ?? id,
    [stations],
  )

  const rows = useMemo(
    () =>
      users.map((u) => ({
        u,
        stationsText: u.globalAdmin
          ? 'Alle (Global Admin)'
          : u.stationAccess.map((a) => stationLabel(a.stationId)).join(', ') || '—',
      })),
    [users, stationLabel],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <PageHeader
        title="Zugriffsberechtigungen"
        description="Lege fest, wer auf welche Tankstelle und welche Funktionen zugreifen darf."
      />

      {err ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" onClick={openCreate}>
          + Zugriff hinzufügen
        </Button>
        {loading ? <span className="text-sm text-[var(--text-muted)]">Lade …</span> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Benutzername</th>
              <th className="px-4 py-3 font-medium">Stationen</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ u, stationsText }) => (
              <tr key={u.id} className="border-b border-[var(--border-subtle)]/60">
                <td className="px-4 py-3 font-medium text-[var(--text-main)]">{u.displayName}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{u.username}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{stationsText}</td>
                <td className="px-4 py-3">
                  <span className={u.active ? 'text-emerald-300' : 'text-rose-300'}>{u.active ? 'Aktiv' : 'Inaktiv'}</span>
                  {u.globalAdmin ? <span className="ml-2 text-cyan-300">· Global</span> : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openEdit(u)}>
                      Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      onClick={() => void resetPwd(u.id)}
                    >
                      Passwort
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/25 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">{editingId ? 'Benutzer bearbeiten' : 'Zugriff hinzufügen'}</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Benutzername</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formUser}
                  onChange={(e) => setFormUser(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">{editingId ? 'Neues Passwort (optional)' : 'Passwort'}</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formPass}
                  onChange={(e) => setFormPass(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
                <input type="checkbox" checked={formGlobal} onChange={(e) => setFormGlobal(e.target.checked)} />
                Global Admin (alle Stationen)
              </label>
              {!formGlobal ? (
                <>
                  <label className="block text-sm">
                    <span className="text-[var(--text-muted)]">Rolle</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-main)]">Stationen</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stations.map((s) => {
                        const on = formStations.has(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleStation(s.id)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                              on
                                ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-main)]/80 text-[var(--text-muted)] hover:border-cyan-500/30'
                            }`}
                          >
                            {on ? <Check className="h-4 w-4 text-cyan-300" /> : <span className="h-4 w-4" />}
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-main)]">Berechtigungen</p>
                    <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                      {PERMISSION_UI.map((p) => {
                        const on = formPerms[p.key]
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => togglePerm(p.key)}
                            className={`rounded-full border px-3 py-1.5 text-xs transition ${
                              on
                                ? 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100'
                                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-fuchsia-500/25'
                            }`}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                Zugriff aktiv
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" disabled={saving} onClick={() => void save()}>
                Benutzer speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
