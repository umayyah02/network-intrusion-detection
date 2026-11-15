import { ShieldCheck } from 'lucide-react'
import { pages } from '../../lib/navigation'
import type { Page } from '../../lib/navigation'
import { cx } from '../ui/cx'

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
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-void/95 backdrop-blur-xl',
          'transition-transform duration-200 motion-reduce:transition-none md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-line px-6">
          <ShieldCheck aria-hidden="true" className="size-8 text-accent" />
          <div>
            <h1 className="font-semibold tracking-[0.12em] text-fg">INIDS</h1>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted">
              Intrusion detection
            </p>
          </div>
        </div>

        <nav aria-label="Primary" className="px-4 pt-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Workspace
          </p>
          <ul className="mt-3 space-y-1">
            {pages.map(({ name, icon: Icon }) => {
              const active = activePage === name
              return (
                <li key={name}>
                  <button
                    onClick={() => onNavigate(name)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      active
                        ? 'bg-accent-soft font-medium text-accent shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
                        : 'text-muted hover:bg-accent-soft hover:text-fg',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    <span>{name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <p className="mt-auto px-6 pb-5 text-[10px] text-muted">INIDS · Network Security</p>
      </aside>
    </>
  )
}
