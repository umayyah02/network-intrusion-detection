import type { LucideIcon } from 'lucide-react'
import { GlassPanel } from '../ui'
import { Sparkline } from './Sparkline'

type StatCardProps = {
  title: string
  value: string
  note: string
  icon: LucideIcon
  spark?: number[]
  /** Tailwind text color class for icon and sparkline. */
  tone?: string
}

export function StatCard({ title, value, note, icon: Icon, spark, tone = 'text-accent' }: StatCardProps) {
  return (
    <GlassPanel className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{title}</p>
          <p className="mt-2 truncate font-mono text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft ${tone}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      {spark && <Sparkline values={spark} className={tone} label={`${title} by batch`} />}
      <p className="text-xs text-muted">{note}</p>
    </GlassPanel>
  )
}
