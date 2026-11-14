type SparklineProps = {
  values: number[]
  /** Tailwind text color class; the line uses currentColor. */
  className?: string
  label?: string
}

export function Sparkline({ values, className = 'text-accent', label }: SparklineProps) {
  if (values.length < 2) {
    return <div className="h-10" aria-hidden="true" />
  }
  const w = 120
  const h = 40
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - 4 - ((v - min) / span) * (h - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`h-10 w-full ${className}`}
      role="img"
      aria-label={label ?? 'Trend by batch'}
    >
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill="currentColor" opacity="0.12" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
