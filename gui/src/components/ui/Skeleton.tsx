import type { HTMLAttributes } from 'react'
import { cx } from './cx'

/** Loading placeholder. Give it a size via className, e.g. "h-8 w-32". */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cx('animate-shimmer rounded-lg bg-accent-soft', className)}
      {...rest}
    />
  )
}
