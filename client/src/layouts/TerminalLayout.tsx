import { Outlet } from 'react-router-dom'

/** Vollbild-Terminal ohne Sidebar/Topbar (Stations-Tablet an der Tankstelle). */
export function TerminalLayout() {
  return (
    <div className="min-h-dvh bg-[var(--bg-main)] text-[var(--text-main)]">
      <Outlet />
    </div>
  )
}
