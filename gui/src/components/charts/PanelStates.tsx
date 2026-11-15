import { TriangleAlert, Inbox } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import { Button, GlassPanel } from '../ui'
import { describeError } from '../../lib/describeError'

export function ErrorCard({
  message,
  onRetry,
  title = 'Could not load the dashboard',
}: {
  message: string
  onRetry: () => void
  title?: string
}) {
  return (
    <GlassPanel glow="danger" role="alert" className="flex flex-wrap items-center gap-4">
      <TriangleAlert className="text-sev-high" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{message}</p>
      </div>
      <Button onClick={onRetry}>Retry</Button>
    </GlassPanel>
  )
}

export function EmptyState({
  title = 'No detection results yet',
  body = 'Load a dataset and run detection to see statistics, charts and threats here.',
  cta = true,
  href = '#detection',
  ctaLabel = 'Go to Detection',
  href2,
  ctaLabel2,
}: {
  title?: string
  body?: string
  cta?: boolean
  href?: string
  ctaLabel?: string
  href2?: string
  ctaLabel2?: string
}) {
  return (
    <GlassPanel className="flex flex-col items-center gap-3 py-12 text-center">
      <Inbox size={32} className="text-muted" aria-hidden="true" />
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {cta && (
        <a href={href} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:brightness-110">
          {ctaLabel}
        </a>
      )}
      {cta && href2 && (
        <a href={href2} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
          {ctaLabel2}
        </a>
      )}
    </GlassPanel>
  )
}

/** True/false once known whether the backend has a dataset loaded (null while checking or unknown). */
function useDatasetLoaded(enabled: boolean): boolean | null {
  const [loaded, setLoaded] = useState<boolean | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    apiFetch(endpoints.datasets, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setLoaded((data.datasets ?? []).some((d: { status: string }) => d.status === 'Loaded'))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [enabled])
  return loaded
}

/** Plain-language state for a failed load: setup steps get a guide, real failures get a retry. */
export function ErrorState({ error, what, onRetry }: { error: unknown; what: string; onRetry: () => void }) {
  const v = describeError(error, what)
  const noResults = v.kind === 'setup' && v.href === '#detection'
  const datasetLoaded = useDatasetLoaded(noResults)

  if (v.kind === 'setup') {
    if (noResults && datasetLoaded === false)
      return (
        <EmptyState
          title="No dataset loaded"
          body="Load a dataset first, then run detection to see results here."
          href="#dataset"
          ctaLabel="Go to Dataset"
        />
      )
    return <EmptyState title={v.title} body={v.body} href={v.href} ctaLabel={v.hrefLabel} />
  }
  return <ErrorCard title={v.title} message={v.body} onRetry={onRetry} />
}
