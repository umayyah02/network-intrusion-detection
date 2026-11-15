import type { DetectionResult } from '../../types/api'
import { Pill } from '../ui'
import type { PillTone } from '../ui'

const sevTone: Record<string, PillTone> = { High: 'high', Medium: 'medium', Low: 'low' }

/** Rows are identified by flow id only: the backend provides no IP or timestamp. */
export function LatestThreatsTable({ threats }: { threats: DetectionResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2 pr-4 font-medium">Flow ID</th>
            <th className="py-2 pr-4 font-medium">Attack type</th>
            <th className="py-2 pr-4 font-medium">Severity</th>
            <th className="py-2 pr-4 font-medium">Confidence</th>
            <th className="py-2 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {threats.map((t) => (
            <tr key={String(t.id)} className="border-t border-line">
              <td className="py-2.5 pr-4 font-mono">#{t.id}</td>
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
