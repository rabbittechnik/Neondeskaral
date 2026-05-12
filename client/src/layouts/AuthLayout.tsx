import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--bg-main)] px-4 py-10 text-[var(--text-main)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.25), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(244,114,182,0.12), transparent)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}
