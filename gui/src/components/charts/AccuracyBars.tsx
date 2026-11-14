export type AccuracyRow = { name: string; value: number } // value 0..1

export function AccuracyBars({ rows }: { rows: AccuracyRow[] }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span>{r.name}</span>
            <span className="font-mono">{(r.value * 100).toFixed(2)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-accent-soft">
            <div
              className="h-full rounded-full bg-linear-to-r from-teal to-accent shadow-glow"
              style={{ width: `${Math.min(Math.max(r.value, 0), 1) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
