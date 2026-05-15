export type AppTheme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'rabbit_station_theme'

export function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#eaf1f8' : '#0a1628')
}

export function persistTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  applyTheme(theme)
}
