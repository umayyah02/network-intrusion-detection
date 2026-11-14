import { TriangleAlert, Inbox } from 'lucide-react'
import { Button, GlassPanel } from '../ui'

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GlassPanel glow="danger" role="alert" className="flex flex-wrap items-center gap-4">
      <TriangleAlert className="text-sev-high" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Could not load the dashboard</p>
        <p className="text-sm text-muted">{message}. Is the C++ backend running?</p>
      </div>
      <Button onClick={onRetry}>Retry</Button>
    </GlassPanel>
  )
}

export function EmptyState() {
  return (
    <GlassPanel className="flex flex-col items-center gap-3 py-12 text-center">
      <Inbox size={32} className="text-muted" aria-hidden="true" />
      <p className="text-lg font-semibold">No detection results yet</p>
      <p className="max-w-md text-sm text-muted">Load a dataset and run detection to see statistics, charts and threats here.</p>
      <a href="#detection" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:brightness-110">
        Go to Detection
      </a>
    </GlassPanel>
  )
}
