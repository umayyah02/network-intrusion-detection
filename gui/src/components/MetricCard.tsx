export function MetricCard({
  title,
  value,
  note,
  icon,
  color,
}: {
  title: string
  value: string
  note: string
  icon: string
  color: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</h3>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${color}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{note}</p>
    </div>
  )
}
