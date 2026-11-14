export type DonutSlice = { name: string; value: number }

const palette = [
  'var(--color-accent)',
  'var(--color-teal)',
  'var(--color-sev-medium)',
  'var(--color-sev-high)',
  '#a78bfa',
  '#60a5fa',
]

/** Slices are listed with name and count beside the ring, so color is never the only signal. */
export function Donut({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  let offset = 0
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Attack type distribution">
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--color-line)" strokeWidth="12" />
          {total > 0 &&
            slices.map((s, i) => {
              const pct = (s.value / total) * 100
              const el = (
                <circle
                  key={s.name}
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke={palette[i % palette.length]}
                  strokeWidth="12"
                  pathLength={100}
                  strokeDasharray={`${Math.max(pct - 0.8, 0)} ${100 - Math.max(pct - 0.8, 0)}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += pct
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-semibold">{total.toLocaleString()}</span>
          <span className="text-[11px] text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-[9rem] flex-1 space-y-3 text-sm">
        {slices.map((s, i) => (
          <li key={s.name} className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: palette[i % palette.length] }} />
              <span className="break-words font-medium">{s.name}</span>
            </span>
            <span className="mt-0.5 block pl-[18px] font-mono text-xs text-muted">
              {s.value.toLocaleString()} ({total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0'}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
