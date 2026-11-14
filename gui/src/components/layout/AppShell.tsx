import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Page } from '../../lib/navigation'
import { Sidebar } from './Sidebar'
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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200">
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
        <Topbar activePage={activePage} onOpenMenu={() => setSidebarOpen(true)} />

        <main className="mx-auto max-w-[1600px] p-4 sm:p-8">
          {children}
          <footer className="mt-10 border-t border-slate-800 py-5 text-center text-xs text-slate-600">
            INIDS · Intelligent Network Intrusion Detection System 
          </footer>
        </main>
      </div>
    </div>
  )
}
