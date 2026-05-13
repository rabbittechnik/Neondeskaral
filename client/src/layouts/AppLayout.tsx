import { useEffect } from 'react'
import { Outlet, useMatches } from 'react-router-dom'
import { AppFooter } from '../components/layout/AppFooter'
import { Sidebar } from '../components/sidebar/Sidebar'
import { Topbar } from '../components/topbar/Topbar'

const BRAND_TITLE = 'Rabbit-Technik Station'

export function AppLayout() {
  const matches = useMatches()
  useEffect(() => {
    let page = ''
    for (let i = matches.length - 1; i >= 0; i--) {
      const h = matches[i]?.handle as { title?: string } | undefined
      if (h?.title) {
        page = h.title
        break
      }
    }
    document.title = page ? `${page} · ${BRAND_TITLE}` : BRAND_TITLE
  }, [matches])

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
