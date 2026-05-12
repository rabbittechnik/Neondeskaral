import {
  Bell,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Search,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMatches, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'
import { useSidebar } from '../../store/sidebar-context'
import { Avatar } from '../ui/Avatar'

const MOCK_STATIONS = [
  'Aral Bodelshausen',
  'Shell Reutlingen',
  'Esso Metzingen',
]

export function Topbar() {
  const { collapsed, toggleCollapsed, toggleMobile } = useSidebar()
  const { user, logout } = useAuth()
  const matches = useMatches()
  const navigate = useNavigate()
  const [stationOpen, setStationOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [station, setStation] = useState(MOCK_STATIONS[0])
  const stationRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const title = useMemo(() => {
    for (let i = matches.length - 1; i >= 0; i--) {
      const h = matches[i]?.handle as { title?: string } | undefined
      if (h?.title) return h.title
    }
    return 'NeonShift Station'
  }, [matches])

  useEffect(() => {
    if (!stationOpen && !profileOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (stationOpen && stationRef.current && !stationRef.current.contains(t)) {
        setStationOpen(false)
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(t)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [stationOpen, profileOpen])

  return (
    <header className="sticky top-0 z-30 flex h-[64px] shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-main)]/85 px-3 backdrop-blur-md md:gap-4 md:px-5">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)] lg:hidden"
        aria-label="Menü öffnen"
        onClick={toggleMobile}
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        className="hidden h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)] lg:flex"
        aria-label={collapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
        onClick={toggleCollapsed}
        title="Sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 sm:block md:max-w-[200px] lg:max-w-[240px]">
        <p className="truncate text-sm font-semibold text-[var(--text-main)]">
          {title}
        </p>
      </div>

      <div className="relative" ref={stationRef}>
        <button
          type="button"
          onClick={() => setStationOpen((o) => !o)}
          className="flex max-w-[200px] items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-left text-sm text-[var(--text-main)] hover:border-cyan-400/35 md:max-w-[260px]"
          aria-expanded={stationOpen}
          aria-haspopup="listbox"
        >
          <MapPin className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{station}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </button>
        {stationOpen ? (
          <ul
            className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 shadow-[var(--shadow-card)]"
            role="listbox"
          >
            {MOCK_STATIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className={`flex w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    s === station
                      ? 'text-cyan-200'
                      : 'text-[var(--text-muted)]'
                  }`}
                  onClick={() => {
                    setStation(s)
                    setStationOpen(false)
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mx-auto hidden min-w-0 flex-1 md:block">
        <label className="relative block">
          <span className="sr-only">Suche</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="search"
            placeholder="Suche (Mitarbeiter, Module, …)"
            className="h-10 w-full max-w-2xl rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] py-2 pl-10 pr-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:border-cyan-400/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
          />
        </label>
      </div>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            9+
          </span>
        </button>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-white/5"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <Avatar name={user?.displayName ?? 'Admin'} size="sm" />
            <div className="hidden text-left lg:block">
              <p className="text-sm font-medium leading-tight text-[var(--text-main)]">
                {user?.displayName ?? '—'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Administrator</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-[var(--text-faint)] lg:block" />
          </button>
          {profileOpen ? (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 shadow-[var(--shadow-card)]"
              role="menu"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]"
                onClick={() => {
                  setProfileOpen(false)
                  navigate('/account')
                }}
              >
                <User className="h-4 w-4" />
                Mein Konto
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  setProfileOpen(false)
                  logout()
                  navigate('/login')
                }}
              >
                <LogOut className="h-4 w-4" />
                Abmelden
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
