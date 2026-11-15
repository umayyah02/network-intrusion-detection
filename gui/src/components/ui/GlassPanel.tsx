import type { HTMLAttributes } from 'react'
import { cx } from './cx'

type Glow = 'none' | 'accent' | 'warn' | 'danger'

const glowClass: Record<Glow, string> = {
  none: '',
  accent: 'shadow-glow',
  warn: 'shadow-glow-warn',
  danger: 'shadow-glow-danger',
}

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  glow?: Glow
  /** Remove default padding (for tables that fill the panel). */
  flush?: boolean
}

export function GlassPanel({
  glow = 'none',
  flush = false,
  className,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={cx(
        'glass min-w-0 text-fg',
        flush ? '' : 'p-5',
        glowClass[glow],
        className,
      )}
      {...rest}
    />
  )
}
