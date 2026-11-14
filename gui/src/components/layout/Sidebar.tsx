import { pages } from '../../lib/navigation'
import type { Page } from '../../lib/navigation'

export function Sidebar({
  activePage,
  open,
  onNavigate,
  onClose,
}: {
  activePage: Page
  open: boolean
  onNavigate: (page: Page) => void
  onClose: () => void
}) {
  return (
    <>
      {open && (
        <button
          aria-label="Close navigation menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-[#0c1220] transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-bold text-slate-950">
            IN
          </div>
          <div>
            <h1 className="font-semibold tracking-wide text-white">INIDS</h1>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Network security
            </p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Workspace
          </p>
          <nav className="mt-3 space-y-1">
            {pages.map((page) => (
              <button
                key={page.name}
                onClick={() => onNavigate(page.name)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  activePage === page.name
                    ? 'bg-cyan-400/10 font-medium text-cyan-300'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">{page.icon}</span>
                <span>{page.name}</span>
                {activePage === page.name && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-slate-300">C++ Backend Integration</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Dataset, detection, and evaluation powered by the C++ API.
            </p>
          </div>
          <p className="px-2 pt-4 text-[10px] text-slate-600">INIDS · Network Security</p>
        </div>
      </aside>
    </>
  )
}
