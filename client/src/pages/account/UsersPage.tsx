import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { MoreHorizontal, Search } from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import { apiGet, apiSend } from '../../services/api'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import {
  ADMIN_FORM_ROLES,
  ADMIN_PERMISSION_UI,
  emptyAdminPerms,
} from '../../config/adminUserPermissionUi'
import { CHIEF_ADMIN_USER_ID } from '../../constants/adminUsers'

type StationRow = { id: string; name: string }

type ManagedUser = {
  id: string
  username: string
  displayName: string
  email: string | null
  lastLoginAt: string | null
  globalAdmin: boolean
  active: boolean
  stationAccess: { stationId: string; role: string; permissions: Record<string, boolean> }[]
}

type AuditRow = {
  id: string
  user_id: string | null
  action: string
  target_user_id: string | null
  station_id: string | null
  details_json: string | null
  created_at: string
  created_by: string | null
}

type RoleFilter = 'all' | 'admin' | 'stationsleiter' | 'teamleiter'

function formatDeDt(iso?: string | null): string {
  if (!iso?.trim()) return 'Noch nie'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const y = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${mo}.${y}, ${h}:${mi} Uhr`
}

function displayRole(u: ManagedUser): string {
  if (u.globalAdmin) return 'Chef / Administrator'
  const r = u.stationAccess[0]?.role ?? ''
  if (r === 'stationsleiter') return 'Stationsleiter'
  if (r === 'teamleiter') return 'Teamleiter'
  if (r === 'buero') return 'Büro / Lohn'
  if (r === 'admin_station') return 'Admin für Station'
  return r ? `Rolle: ${r}` : 'Individuelle Rechte'
}

function splitDisplayName(name: string): { first: string; last: string } {
  const t = name.trim()
  if (!t) return { first: '', last: '' }
  const p = t.split(/\s+/)
  return { first: p[0] ?? '', last: p.slice(1).join(' ') }
}

export function UsersPage() {
  const { user, refreshMe } = useAuth()
  if (!user?.globalAdmin) {
    return <Navigate to="/account" replace />
  }

  const [stations, setStations] = useState<StationRow[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [menuUserId, setMenuUserId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [logOpen, setLogOpen] = useState(false)
  const [logRows, setLogRows] = useState<AuditRow[]>([])
  const [logLoading, setLogLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formFirst, setFormFirst] = useState('')
  const [formLast, setFormLast] = useState('')
  const [formUser, setFormUser] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPass, setFormPass] = useState('')
  const [formRole, setFormRole] = useState('teamleiter')
  const [formGlobal, setFormGlobal] = useState(false)
  const [formActive, setFormActive] = useState(true)
  const [formStations, setFormStations] = useState<Set<string>>(() => new Set())
  const [formPerms, setFormPerms] = useState<Record<string, boolean>>(emptyAdminPerms)
  const [saving, setSaving] = useState(false)

  const [confirmDisable, setConfirmDisable] = useState<ManagedUser | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ManagedUser | null>(null)

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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuUserId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const stationLabel = useCallback(
    (id: string) => stations.find((s) => s.id === id)?.name ?? id,
    [stations],
  )

  const openLog = async () => {
    setLogOpen(true)
    setLogLoading(true)
    const res = await apiGet<AuditRow[]>('/access/audit-log', { limit: '200' })
    if (res.ok && Array.isArray(res.data)) setLogRows(res.data)
    else setLogRows([])
    setLogLoading(false)
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter === 'admin' && !u.globalAdmin) return false
      if (roleFilter === 'stationsleiter' && (u.globalAdmin || u.stationAccess[0]?.role !== 'stationsleiter')) return false
      if (roleFilter === 'teamleiter' && (u.globalAdmin || u.stationAccess[0]?.role !== 'teamleiter')) return false
      if (!q) return true
      const stationsText = u.globalAdmin
        ? 'alle'
        : u.stationAccess.map((a) => stationLabel(a.stationId)).join(' ')
      const blob = `${u.username} ${u.displayName} ${u.email ?? ''} ${stationsText}`.toLowerCase()
      return blob.includes(q)
    })
  }, [users, search, roleFilter, stationLabel])

  const openCreate = () => {
    setEditingId(null)
    setFormFirst('')
    setFormLast('')
    setFormUser('')
    setFormEmail('')
    setFormPass('')
    setFormRole('teamleiter')
    setFormGlobal(false)
    setFormActive(true)
    setFormStations(new Set())
    setFormPerms(emptyAdminPerms())
    setModalOpen(true)
    setMenuUserId(null)
  }

  const openEdit = (u: ManagedUser) => {
    setEditingId(u.id)
    const { first, last } = splitDisplayName(u.displayName)
    setFormFirst(first)
    setFormLast(last)
    setFormUser(u.username)
    setFormEmail(u.email ?? '')
    setFormPass('')
    setFormRole(u.stationAccess[0]?.role ?? 'teamleiter')
    setFormGlobal(u.globalAdmin)
    setFormActive(u.active)
    setFormStations(new Set(u.stationAccess.map((a) => a.stationId)))
    const merged = emptyAdminPerms()
    const p0 = u.stationAccess[0]?.permissions ?? {}
    for (const k of Object.keys(merged)) merged[k] = Boolean(p0[k])
    setFormPerms(merged)
    setModalOpen(true)
    setMenuUserId(null)
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
    const displayName = `${formFirst.trim()} ${formLast.trim()}`.trim()
    if (!displayName) {
      setErr('Bitte Vor- und Nachnamen angeben.')
      return
    }
    if (!formGlobal && formStations.size === 0) {
      setErr('Bitte mindestens eine Station auswählen.')
      return
    }
    setSaving(true)
    setErr(null)
    const base = {
      displayName,
      username: formUser.trim(),
      email: formEmail.trim(),
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
      : await apiSend<ManagedUser>('POST', '/access/users', {
          ...base,
          ...(formPass.trim() ? { password: formPass } : {}),
        })
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
    setMenuUserId(null)
  }

  const runDisable = async (u: ManagedUser) => {
    const res = await apiSend('POST', `/access/users/${encodeURIComponent(u.id)}/disable`, {})
    if (!res.ok) setErr(res.error)
    await load()
    setMenuUserId(null)
  }

  const runEnable = async (u: ManagedUser) => {
    const res = await apiSend('POST', `/access/users/${encodeURIComponent(u.id)}/enable`, {})
    if (!res.ok) setErr(res.error)
    await load()
    setMenuUserId(null)
  }

  const runDelete = async (u: ManagedUser) => {
    const res = await apiSend('DELETE', `/access/users/${encodeURIComponent(u.id)}`, undefined)
    if (!res.ok) setErr(res.error)
    await load()
    setMenuUserId(null)
  }

  const filterChip = (k: RoleFilter, label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => setRoleFilter(k)}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
        roleFilter === k
          ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
          : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <PageHeader
        title="Benutzer verwalten"
        description="Login-Konten für Leitung und Admin — getrennt von der Mitarbeiterverwaltung."
      />

      {err ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="search"
            placeholder="Suche: Name, Benutzername, E-Mail, Station…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] py-2 pl-10 pr-3 text-sm text-[var(--text-main)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void openLog()}>
            Log anzeigen
          </Button>
          <Button type="button" variant="primary" onClick={openCreate}>
            Benutzer anlegen
          </Button>
          {loading ? <span className="text-sm text-[var(--text-muted)]">Lade …</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterChip('all', 'Alle')}
        {filterChip('admin', 'Administratoren')}
        {filterChip('stationsleiter', 'Stationsleiter')}
        {filterChip('teamleiter', 'Teamleiter')}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Benutzername</th>
              <th className="px-4 py-3 font-medium">E-Mail</th>
              <th className="px-4 py-3 font-medium">Rolle</th>
              <th className="px-4 py-3 font-medium">Stationen / Zugriff</th>
              <th className="px-4 py-3 font-medium">Letzter Login</th>
              <th className="px-4 py-3 font-medium w-14">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border-subtle)]/70 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <span className="font-medium text-[var(--text-main)]">{u.username}</span>
                  <p className="text-xs text-[var(--text-muted)]">{u.displayName}</p>
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{u.email ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--text-main)]">{displayRole(u)}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {u.globalAdmin ? (
                    <span className="text-cyan-200/90">Alle Stationen</span>
                  ) : (
                    u.stationAccess.map((a) => stationLabel(a.stationId)).join(', ') || '—'
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{formatDeDt(u.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  <div className="relative flex justify-end" ref={menuUserId === u.id ? menuRef : undefined}>
                    <button
                      type="button"
                      aria-label="Aktionen"
                      className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-main)]"
                      onClick={() => setMenuUserId((id) => (id === u.id ? null : u.id))}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                    {menuUserId === u.id ? (
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 shadow-xl">
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                          onClick={() => {
                            openEdit(u)
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                          onClick={() => void resetPwd(u.id)}
                        >
                          Passwort zurücksetzen
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                          onClick={() => {
                            openEdit(u)
                          }}
                        >
                          Berechtigungen bearbeiten
                        </button>
                        {u.id !== CHIEF_ADMIN_USER_ID ? (
                          u.active ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-amber-200 hover:bg-white/5"
                              onClick={() => {
                                setConfirmDisable(u)
                                setMenuUserId(null)
                              }}
                            >
                              Deaktivieren
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-emerald-200 hover:bg-white/5"
                              onClick={() => void runEnable(u)}
                            >
                              Aktivieren
                            </button>
                          )
                        ) : null}
                        {u.id !== CHIEF_ADMIN_USER_ID ? (
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-rose-200 hover:bg-white/5"
                            onClick={() => {
                              setConfirmDelete(u)
                              setMenuUserId(null)
                            }}
                          >
                            Löschen
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filteredUsers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Keine Benutzer für diesen Filter.</p>
        ) : null}
      </div>

      {logOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <h2 className="text-lg font-semibold text-[var(--text-main)]">Protokoll</h2>
              <Button type="button" variant="ghost" onClick={() => setLogOpen(false)}>
                Schließen
              </Button>
            </div>
            <div className="max-h-[calc(85vh-5rem)] overflow-auto p-4">
              {logLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Lade …</p>
              ) : logRows.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Noch keine Logeinträge vorhanden.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)]">
                      <th className="py-2 pr-2">Zeit</th>
                      <th className="py-2 pr-2">Aktion</th>
                      <th className="py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logRows.map((r) => (
                      <tr key={r.id} className="border-t border-[var(--border-subtle)]/60">
                        <td className="py-2 pr-2 align-top text-[var(--text-muted)]">{formatDeDt(r.created_at)}</td>
                        <td className="py-2 pr-2 align-top font-medium text-[var(--text-main)]">{r.action}</td>
                        <td className="py-2 align-top text-[var(--text-muted)]">
                          {r.user_id ? `Akteur: ${r.user_id.slice(0, 8)}…` : null}
                          {r.target_user_id ? ` · Ziel: ${r.target_user_id.slice(0, 8)}…` : null}
                          {r.details_json ? (
                            <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-all text-[10px] opacity-80">
                              {r.details_json}
                            </pre>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/25 bg-[var(--bg-card)] p-6 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">
              {editingId ? 'Benutzer bearbeiten' : 'Benutzer anlegen'}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Benutzername (Login)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formUser}
                  onChange={(e) => setFormUser(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Vorname</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formFirst}
                  onChange={(e) => setFormFirst(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Nachname</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formLast}
                  onChange={(e) => setFormLast(e.target.value)}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">E-Mail</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">
                  {editingId ? 'Neues Passwort (optional)' : 'Passwort (optional)'}
                </span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                  value={formPass}
                  onChange={(e) => setFormPass(e.target.value)}
                  autoComplete="new-password"
                />
                {!editingId ? (
                  <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                    Ohne Passwort wird der Login gesperrt, bis ein Administrator ein Passwort setzt.
                  </p>
                ) : null}
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={formGlobal}
                  onChange={(e) => setFormGlobal(e.target.checked)}
                  disabled={editingId === CHIEF_ADMIN_USER_ID}
                />
                Chef / Administrator (alle Stationen)
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-main)] sm:col-span-2">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                Aktiv
              </label>
              {!formGlobal ? (
                <>
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-[var(--text-muted)]">Rolle (Stationskontext)</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-[var(--text-main)]"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                    >
                      {ADMIN_FORM_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-[var(--text-main)]">Stationen</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stations.map((s) => {
                        const on = formStations.has(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleStation(s.id)}
                            className={`rounded-xl border px-3 py-2 text-sm transition ${
                              on
                                ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-100'
                                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-cyan-500/30'
                            }`}
                          >
                            {s.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-[var(--text-main)]">Berechtigungen</p>
                    <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                      {ADMIN_PERMISSION_UI.map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
                          <input type="checkbox" checked={Boolean(formPerms[p.key])} onChange={() => togglePerm(p.key)} />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" variant="primary" disabled={saving} onClick={() => void save()}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDisable)}
        title="Benutzer deaktivieren?"
        message="Der Benutzer kann sich nicht mehr anmelden. Daten bleiben erhalten."
        cancelLabel="Abbrechen"
        confirmLabel="Deaktivieren"
        variant="danger"
        onCancel={() => setConfirmDisable(null)}
        onConfirm={() => {
          const u = confirmDisable
          setConfirmDisable(null)
          if (u) void runDisable(u)
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Benutzer löschen?"
        message="Der Zugang und die Stationszuordnungen werden entfernt. Dies kann nicht rückgängig gemacht werden."
        cancelLabel="Abbrechen"
        confirmLabel="Löschen"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const u = confirmDelete
          setConfirmDelete(null)
          if (u) void runDelete(u)
        }}
      />
    </div>
  )
}
