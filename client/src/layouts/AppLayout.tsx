import { Outlet } from 'react-router-dom'
import { AppFooter } from '../components/layout/AppFooter'
import { Sidebar } from '../components/sidebar/Sidebar'
import { Topbar } from '../components/topbar/Topbar'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-[var(--bg-main)] text-[var(--text-main)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-0">
        <Topbar />
        <main className="flex-1 overflow-auto px-4 py-5 md:px-6 lg:px-8">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
