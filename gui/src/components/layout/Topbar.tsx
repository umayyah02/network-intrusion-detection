import { Menu, Play } from 'lucide-react'
import type { HealthStatus } from '../../hooks/useHealth'
import type { Page } from '../../lib/navigation'
import { Button } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { StatusChip } from './StatusChip'

export function Topbar({
  activePage,
  status,
  loadedDataset,
  latestModel,
  onOpenMenu,
}: {
  activePage: Page
  status: HealthStatus
  loadedDataset: string | null
  latestModel: string | null
  onOpenMenu: () => void
}) {
  const modelLabel =
    latestModel === 'decision_tree'
      ? 'Decision Tree'
      : latestModel === 'knn'
        ? 'KNN'
        : (latestModel ?? 'None trained')

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-line bg-void/80 px-4 backdrop-blur-xl sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line-strong text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="text-xs text-muted">INIDS / Workspace</p>
          <p className="mt-1 truncate text-sm font-medium text-fg">{activePage}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden lg:block">
          <Pill tone="neutral" className="px-3 py-1.5 font-medium" title="Most recently trained model">
            Model: {modelLabel}
          </Pill>
        </div>
        <div className="hidden md:block">
          <Pill
            tone="neutral"
            className="max-w-56 truncate px-3 py-1.5 font-medium"
            title="Dataset loaded in the backend"
          >
            Dataset: {loadedDataset ?? 'None loaded'}
          </Pill>
        </div>
        <div className="hidden md:block">
          <Button
            size="sm"
            disabled
            title="Replay arrives with the dashboard milestone"
          >
            <Play aria-hidden="true" className="size-3.5" />
            Start replay
          </Button>
        </div>
        <StatusChip status={status} />
      </div>
    </header>
  )
}
