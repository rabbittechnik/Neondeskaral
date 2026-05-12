import { Bell, Calendar, ClipboardCheck, Inbox } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'
import { useStation } from '../../context/station-context'
import { apiGet } from '../../services/api'
import { canSeeNotificationBell } from '../../utils/notificationBell'
import { NOTIFICATIONS_REFRESH_EVENT } from '../../utils/notificationsRefresh'

type NotificationItem = {
  id: string
  type: string
  severity: 'warning' | 'info'
  title: string
  message: string
  actionLabel: string
  actionRoute: string
  detailCount?: number
}

type SummaryPayload = {
  count: number
  items: NotificationItem[]
}

function iconForType(type: string) {
  if (type === 'time_approval') return ClipboardCheck
  if (type === 'tuv_report') return Calendar
  if (type === 'absence_request') return Inbox
  return Bell
}

function badgeText(n: number): string {
  if (n <= 0) return ''
  if (n > 9) return '9+'
  return String(n)
}

export function NotificationBell() {
  const { user } = useAuth()
  const { stationId } = useStation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<SummaryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const allowed = canSeeNotificationBell(user, stationId)

  const load = useCallback(async () => {
    if (!allowed || !stationId) {
      setSummary(null)
      return
    }
    setLoading(true)
    const res = await apiGet<SummaryPayload>('/notifications/summary', { stationId })
    if (res.ok) setSummary(res.data)
    else setSummary({ count: 0, items: [] })
    setLoading(false)
  }, [allowed, stationId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!allowed) return
    const id = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(id)
  }, [allowed, load])

  useEffect(() => {
    const onRefresh = () => void load()
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current && !wrapRef.current.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!allowed) return null

  const count = summary?.count ?? 0
  const items = summary?.items ?? []
  const badge = badgeText(count)
  const hasIssues = count > 0

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]"
        aria-label="Benachrichtigungen"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {badge ? (
          <span
            className={`absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              hasIssues ? 'bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.55)]' : 'bg-slate-600'
            }`}
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-[var(--radius-md)] border border-cyan-500/25 bg-[var(--bg-card)] shadow-[0_0_24px_rgba(34,211,238,0.12)]">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text-main)]">Benachrichtigungen</p>
            {loading ? <p className="mt-1 text-xs text-[var(--text-faint)]">Laden…</p> : null}
          </div>
          <div className="max-h-[min(70vh,24rem)] overflow-y-auto p-2">
            {!loading && items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">Keine offenen Benachrichtigungen</p>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => {
                  const Icon = iconForType(it.type)
                  const sev =
                    it.severity === 'warning'
                      ? 'border-l-amber-400 bg-amber-500/5'
                      : 'border-l-cyan-400 bg-cyan-500/5'
                  return (
                    <li
                      key={it.id}
                      className={`rounded-[var(--radius-sm)] border border-white/10 border-l-4 ${sev} p-3`}
                    >
                      <div className="flex gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200/90" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--text-main)]">{it.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{it.message}</p>
                          <button
                            type="button"
                            className="mt-3 inline-flex w-full items-center justify-center rounded-[var(--radius-sm)] border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20"
                            onClick={() => {
                              setOpen(false)
                              navigate(it.actionRoute)
                            }}
                          >
                            {it.actionLabel}
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
