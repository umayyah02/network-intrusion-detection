import type { DetectionResult } from '../../types/api'
import { Pill } from '../ui'
import type { PillTone } from '../ui'

const sevTone: Record<string, PillTone> = { High: 'high', Medium: 'medium', Low: 'low' }

/** Paged threat rows. Flow id opens the drawer; no IPs or timestamps are shown. */
export function ThreatTable({
  threats,
  startIndex,
  onSelect,
}: {
  threats: DetectionResult[]
  startIndex: number
  onSelect: (t: DetectionResult) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2 pr-4 font-medium">#</th>
            <th className="py-2 pr-4 font-medium">Flow ID</th>
            <th className="py-2 pr-4 font-medium">Attack type</th>
            <th className="py-2 pr-4 font-medium">Severity</th>
            <th className="py-2 pr-4 font-medium">Confidence</th>
            <th className="py-2 pr-4 font-medium">Actual class</th>
            <th className="py-2 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {threats.map((t, i) => (
            <tr key={String(t.id)} className="border-t border-line hover:bg-accent-soft">
              <td className="py-2.5 pr-4 text-muted">{startIndex + i + 1}</td>
              <td className="py-2.5 pr-4">
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className="font-mono text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  #{t.id}
                </button>
              </td>
              <td className="py-2.5 pr-4">{t.label}</td>
              <td className="py-2.5 pr-4">
                <Pill tone={t.severity ? sevTone[t.severity] : 'neutral'}>{t.severity ?? 'N/A'}</Pill>
              </td>
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-accent-soft">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(t.confidence, 1) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs">{(t.confidence * 100).toFixed(1)}%</span>
                </div>
              </td>
              <td className="py-2.5 pr-4">{t.actualLabel}</td>
              <td className="py-2.5">
                <Pill tone={t.correct ? 'success' : 'danger'}>{t.correct ? 'Correct' : 'Incorrect'}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
