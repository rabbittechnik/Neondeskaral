export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-main)] px-4 py-3 text-center text-xs text-[var(--text-faint)] md:flex md:items-center md:justify-between md:px-6">
      <span className="block md:inline">
        Rabbit-Technik Station © 2024 · Version 1.0.0
      </span>
      <span className="mt-1 block md:mt-0">
        <a href="#" className="hover:text-[var(--text-muted)]">
          Impressum
        </a>
        <span className="mx-2 opacity-40">|</span>
        <a href="#" className="hover:text-[var(--text-muted)]">
          Datenschutz
        </a>
      </span>
    </footer>
  )
}
