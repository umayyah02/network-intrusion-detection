import type { Page } from '../../lib/navigation'

export function Topbar({
  activePage,
  onOpenMenu,
}: {
  activePage: Page
  onOpenMenu: () => void
}) {
  return (
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-[#090d16]/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMenu}
              aria-label="Open navigation menu"
              className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 md:hidden"
            >
              ☰
            </button>
            <div>
              <p className="text-xs text-slate-500">INIDS / Workspace</p>
              <p className="mt-1 text-sm font-medium text-white">{activePage}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-300 sm:inline-flex">
              ● C++ Backend API
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-cyan-300">
              M3
            </div>
          </div>
        </header>
  )
}
