import type { Batch } from './derive'

/** Threats per batch of detections (backend order, not clock time). */
export function BarTimeline({ batches }: { batches: Batch[] }) {
  const max = Math.max(...batches.map((b) => b.threats), 1)
  return (
    <div role="img" aria-label="Threats per detection batch" className="flex h-32 items-end gap-2">
      {batches.map((b) => (
        <div key={b.index} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="font-mono text-[10px] text-muted">{b.threats}</span>
          <div
            title={`Batch ${b.index}: ${b.threats} threats of ${b.total} flows`}
            className="w-full rounded-t-md bg-linear-to-t from-accent/30 to-accent"
            style={{ height: `${Math.max((b.threats / max) * 100, b.threats > 0 ? 4 : 1)}%` }}
          />
          <span className="font-mono text-[10px] text-muted">{b.index}</span>
        </div>
      ))}
    </div>
  )
}
