import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/theme-context'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title="Design wechseln"
      aria-label={isLight ? 'Zu dunklem Modus wechseln' : 'Zu hellem Modus wechseln'}
      className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 text-[var(--text-muted)] transition hover:border-[var(--accent-cyan)]/40 hover:bg-[var(--surface-hover)] hover:text-[var(--accent-cyan)] sm:px-3"
    >
      {isLight ? (
        <Moon className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Sun className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className="hidden text-xs font-medium min-[1200px]:inline">
        {isLight ? 'Dunkel' : 'Hell'}
      </span>
    </button>
  )
}
