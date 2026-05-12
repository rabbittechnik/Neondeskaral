import { Outlet } from 'react-router-dom'

export function EmployeeAppLayout() {
  return (
    <div className="min-h-dvh bg-[#070b12] text-slate-100">
      <Outlet />
    </div>
  )
}
