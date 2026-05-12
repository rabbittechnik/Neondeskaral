import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiGet, clearAdminToken, getAdminToken, setAdminToken, API_BASE, type ApiEnvelope } from '../services/api'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  roleId: string
}

type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAdminToken())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    const t = getAdminToken()
    setToken(t)
    if (!t) {
      setUser(null)
      setLoading(false)
      return
    }
    const res = await apiGet<AuthUser>('/auth/me')
    if (res.ok) {
      setUser(res.data)
    } else {
      setUser(null)
      clearAdminToken()
      setToken(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  const login = useCallback(async (username: string, password: string, rememberMe: boolean) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, rememberMe }),
    })
    const json = (await res.json()) as ApiEnvelope<{ token: string; user: AuthUser }>
    if (!res.ok || !json.ok) {
      throw new Error(!json.ok ? json.error : 'Anmeldung fehlgeschlagen')
    }
    setAdminToken(json.data.token, rememberMe)
    setToken(json.data.token)
    setUser(json.data.user)
  }, [])

  const logout = useCallback(() => {
    clearAdminToken()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      refreshMe,
    }),
    [token, user, loading, login, logout, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
