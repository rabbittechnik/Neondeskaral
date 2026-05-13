import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

export function EmployeeAppLayout() {
  const loc = useLocation()
  useEffect(() => {
    const sub = loc.pathname.startsWith('/employee-access') || loc.pathname.startsWith('/employee/')
      ? 'Zugang'
      : 'Mitarbeiter-App'
    document.title = `${sub} · Rabbit-Technik Station`
  }, [loc.pathname])

  return (
    <div className="min-h-dvh bg-[#070b12] text-slate-100">
      <Outlet />
    </div>
  )
}
