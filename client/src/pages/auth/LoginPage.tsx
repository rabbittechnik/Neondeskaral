import { Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAccessDenied(false)
    if (!username.trim() || !password) {
      setError('Bitte Benutzername und Passwort eingeben.')
      return
    }
    if (password === 'wrong') {
      setError('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.')
      return
    }
    if (username === 'denied') {
      setError(null)
      setAccessDenied(true)
      return
    }
    setError(null)
    navigate('/')
  }

  return (
    <Card padding="lg" className="border-[var(--border-strong)] shadow-[var(--shadow-card)]">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-cyan-400/25 to-fuchsia-500/20 ring-1 ring-cyan-400/45">
          <Zap className="h-7 w-7 text-cyan-200" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">NeonShift Station</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Anmeldung für Stationsleitung und Team
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Benutzername oder E-Mail"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          label="Passwort"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? (
          <p className="rounded-[var(--radius-sm)] border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {accessDenied ? (
          <p className="rounded-[var(--radius-sm)] border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Zugriff verweigert. Für diese Station oder dieses Modul haben Sie keine
            Berechtigung.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-[var(--border-strong)] bg-[var(--bg-elevated)] text-cyan-500 focus:ring-cyan-400/30"
            />
            Eingeloggt bleiben
          </label>
          <Link
            to="/login"
            className="text-cyan-300 hover:underline"
            onClick={(e) => {
              e.preventDefault()
              alert('Passwort zurücksetzen folgt in Phase 2.')
            }}
          >
            Passwort vergessen?
          </Link>
        </div>

        <Button type="submit" className="w-full py-2.5">
          Anmelden
        </Button>

        <p className="text-center text-xs text-[var(--text-faint)]">
          Registrierung nur auf Einladung.{' '}
          <span className="text-[var(--text-muted)]">Kontaktieren Sie Ihre Station.</span>
        </p>
      </form>
    </Card>
  )
}
