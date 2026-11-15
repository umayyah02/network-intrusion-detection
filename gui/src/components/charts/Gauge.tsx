/** Semicircle gauge. value is 0..1. Color shifts emerald, amber, rose; the number is always shown. */
export function Gauge({ value, caption }: { value: number; caption: string }) {
  const v = Math.min(Math.max(value, 0), 1)
  const color = v < 0.4 ? 'var(--color-accent)' : v < 0.7 ? 'var(--color-sev-medium)' : 'var(--color-sev-high)'
  const arc = 'M 20 100 A 80 80 0 0 1 180 100'
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-full max-w-[260px]" role="img" aria-label={`${(v * 100).toFixed(1)} percent`}>
        <path d={arc} fill="none" stroke="var(--color-line)" strokeWidth="14" strokeLinecap="round" pathLength={100} />
        <path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v * 100} 100`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.8s ease-out' }}
        />
        <text x="100" y="92" textAnchor="middle" fill="var(--color-fg)" fontSize="30" fontWeight="600" fontFamily="var(--font-mono)">
          {(v * 100).toFixed(1)}%
        </text>
      </svg>
      <p className="-mt-1 text-xs text-muted">{caption}</p>
    </div>
  )
}
