import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Timer } from 'lucide-react'
import { useAuth } from '../../context/auth-context'
import { apiGet } from '../../services/api'
import { useStation } from '../../context/station-context'
import { canAccessTimeApprovalsPage } from '../../utils/timeApproval'
import { Card } from '../../components/ui/Card'

export function PendingTimeApprovalsCard() {
  const { user } = useAuth()
  const { stationId } = useStation()
  const allowed = canAccessTimeApprovalsPage(user)
  const [count, setCount] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!allowed) return
    if (!stationId) {
      setCount(null)
      setErr(null)
      return
    }
    const res = await apiGet<{ count: number }>('/time-entries/pending-approval', { stationId })
    if (!res.ok) {
      setErr(res.error)
      setCount(null)
      return
    }
    setErr(null)
    setCount(res.data.count ?? 0)
  }, [allowed, stationId])

  useEffect(() => {
    void load()
  }, [load])

  if (!allowed) return null

  return (
    <Card className="border border-amber-400/20 bg-gradient-to-br from-amber-500/5 to-transparent">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
          <Timer className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[var(--text-main)]">Zeiten zur Freigabe</h3>
          {!stationId ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">Keine Station ausgewählt.</p>
          ) : err ? (
            <p className="mt-2 text-sm text-rose-300">{err}</p>
          ) : count === null ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">Lade…</p>
          ) : count === 0 ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">Keine offenen Zeitfreigaben.</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Offene Zeitbuchungen:{' '}
              <span className="font-semibold tabular-nums text-amber-100">{count}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/zeiterfassung/freigaben"
              className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--accent-cyan)]/50 bg-[var(--accent-cyan)]/20 px-4 py-2 text-sm font-medium text-[var(--accent-cyan)] shadow-[var(--glow-cyan)] transition hover:bg-[var(--accent-cyan)]/30"
            >
              Prüfen
            </Link>
            <Link
              to="/zeiterfassung/freigaben"
              className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:border-[var(--accent-cyan)]/50"
            >
              Alle anzeigen
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}
