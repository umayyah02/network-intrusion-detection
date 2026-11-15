import type { HealthStatus } from '../../hooks/useHealth'
import { cx } from '../ui/cx'

const config: Record<HealthStatus, { label: string; chip: string; dot: string }> = {
  connecting: {
    label: 'Connecting',
    chip: 'border-sev-medium/40 bg-sev-medium-soft text-sev-medium-fg',
    dot: 'bg-sev-medium animate-pulse motion-reduce:animate-none',
  },
  online: {
    label: 'Backend online',
    chip: 'border-line-strong bg-accent-soft text-accent',
    dot: 'bg-accent shadow-glow',
  },
  offline: {
    label: 'Backend offline',
    chip: 'border-sev-high/40 bg-sev-high-soft text-sev-high-fg',
    dot: 'bg-sev-high',
  },
}

/** Live backend status. Always shows a text label, never color alone. */
export function StatusChip({ status }: { status: HealthStatus }) {
  const { label, chip, dot } = config[status]
  return (
    <span
      role="status"
      className={cx(
        'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium',
        chip,
      )}
    >
      <span aria-hidden="true" className={cx('size-2 rounded-full', dot)} />
      {label}
    </span>
  )
}
