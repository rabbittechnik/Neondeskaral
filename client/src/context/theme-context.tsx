import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  type AppTheme,
} from '../lib/theme'

type ThemeContextValue = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => readStoredTheme())

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
    persistTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      persistTheme(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** Vor erstem Paint (index.html) und beim Provider-Start synchronisieren. */
applyTheme(readStoredTheme())
