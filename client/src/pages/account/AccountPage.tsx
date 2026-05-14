import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../context/auth-context'
import { apiSend } from '../../services/api'

export function AccountPage() {
  const { user, refreshMe } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDisplayName(user?.displayName ?? '')
    setEmail(user?.email ?? '')
    setPhone(user?.phone ?? '')
  }, [user])

  const perms = useMemo(() => {
    const acc = user?.stationAccess ?? []
    return acc.map((a) => `${a.stationId}: ${Object.entries(a.permissions).filter(([, v]) => v).map(([k]) => k).join(', ')}`)
  }, [user])

  const save = async () => {
    setLoading(true)
    setErr(null)
    setMsg(null)
    const res = await apiSend<typeof user>('PUT', '/auth/me', {
      displayName,
      email: email.trim() || null,
      phone: phone.trim() || null,
      ...(newPassword.trim() ? { currentPassword, newPassword: newPassword.trim() } : {}),
    })
    if (!res.ok) setErr(res.error)
    else {
      setMsg('Profil gespeichert.')
      setCurrentPassword('')
      setNewPassword('')
      await refreshMe()
    }
    setLoading(false)
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--text-muted)]">Bitte anmelden.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6 pb-16">
      <PageHeader title="Mein Konto · Profil" description="Eigene Kontaktdaten und Passwort" />
      {err ? <p className="text-sm text-red-200/90">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-200/90">{msg}</p> : null}
      <Card padding="md" className="border-[var(--border-subtle)] space-y-3">
        <label className="block text-xs text-[var(--text-faint)]">
          Anzeigename
          <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="block text-xs text-[var(--text-faint)]">
          E-Mail
          <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-xs text-[var(--text-faint)]">
          Telefon (optional)
          <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <p className="text-xs text-[var(--text-muted)]">
          Rolle: {user.roleLabel ?? user.roleKey ?? '—'} {user.globalAdmin ? '· Global-Admin' : ''}
        </p>
        <div className="border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-[var(--text-main)]">Passwort ändern (optional)</p>
          <input
            type="password"
            placeholder="Aktuelles Passwort"
            className="mt-2 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Neues Passwort"
            className="mt-2 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => void save()} disabled={loading}>
          Profil speichern
        </Button>
      </Card>
      <Card padding="md" className="border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">Stationen & Berechtigungen</h3>
        <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
          {(user.stations ?? []).map((s) => (
            <li key={s.id}>
              {s.name} ({s.federalState})
            </li>
          ))}
        </ul>
        {perms.length ? (
          <ul className="mt-3 space-y-1 font-mono text-[10px] text-[var(--text-faint)]">
            {perms.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  )
}
