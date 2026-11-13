import type { HTMLAttributes } from 'react'
import { cx } from './cx'

export type PillTone = 'high' | 'medium' | 'low' | 'neutral' | 'success' | 'danger'

const toneClass: Record<PillTone, string> = {
  high: 'bg-sev-high-soft text-sev-high-fg',
  medium: 'bg-sev-medium-soft text-sev-medium-fg',
  low: 'bg-sev-low-soft text-sev-low-fg',
  neutral: 'bg-accent-soft text-fg',
  success: 'bg-sev-low-soft text-sev-low-fg',
  danger: 'bg-sev-high-soft text-sev-high-fg',
}

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone
}

/** Always render a text label as children: color is never the only signal. */
export function Pill({ tone = 'neutral', className, ...rest }: PillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        toneClass[tone],
        className,
      )}
      {...rest}
    />
  )
}
