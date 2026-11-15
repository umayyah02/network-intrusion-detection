import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useHealth } from '../../hooks/useHealth'
import type { Page } from '../../lib/navigation'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from './OfflineBanner'
import { Topbar } from './Topbar'

export function AppShell({
  activePage,
  onNavigate,
  children,
}: {
  activePage: Page
  onNavigate: (page: Page) => void
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { status, loadedDataset, latestModel } = useHealth(activePage)

  useEffect(() => {
    if (!sidebarOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  return (
    <div className="min-h-screen bg-console font-sans text-fg">
      <Sidebar
        activePage={activePage}
        open={sidebarOpen}
        onNavigate={(page) => {
          onNavigate(page)
          setSidebarOpen(false)
        }}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="min-h-screen md:pl-64">
        <Topbar
          activePage={activePage}
          status={status}
          loadedDataset={loadedDataset}
          latestModel={latestModel}
          onOpenMenu={() => setSidebarOpen(true)}
        />

        {status === 'offline' && <OfflineBanner />}
        <main className="mx-auto max-w-[1600px] p-4 sm:p-8">
          {children}
          <footer className="mt-10 border-t border-line py-5 text-center text-xs text-muted">
            INIDS · Intelligent Network Intrusion Detection System
          </footer>
        </main>
      </div>
    </div>
  )
}
