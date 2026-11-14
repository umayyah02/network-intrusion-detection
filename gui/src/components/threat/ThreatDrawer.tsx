import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { DetectionResult } from '../../types/api'
import { Button, GlassPanel, Pill } from '../ui'
import type { PillTone } from '../ui'

const sevTone: Record<string, PillTone> = { High: 'high', Medium: 'medium', Low: 'low' }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

/** Detail drawer for one flow. Escape or the backdrop closes it. */
export function ThreatDrawer({ threat, onClose }: { threat: DetectionResult; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close threat details" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <GlassPanel
        role="dialog"
        aria-modal="true"
        aria-label={`Threat details for flow ${threat.id}`}
        glow="danger"
        className="relative h-full w-full max-w-md overflow-y-auto !rounded-none bg-panel-solid"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Flow</p>
            <h3 className="font-mono text-xl font-semibold">#{threat.id}</h3>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-line-strong p-2 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-5">
          <Row label="Predicted attack">{threat.label}</Row>
          <Row label="Severity">
            <Pill tone={threat.severity ? sevTone[threat.severity] : 'neutral'}>{threat.severity ?? 'N/A'}</Pill>
          </Row>
          <Row label="Confidence">
            <span className="font-mono">{(threat.confidence * 100).toFixed(1)}%</span>
          </Row>
          <Row label="Actual class">{threat.actualLabel}</Row>
          <Row label="Prediction">
            <Pill tone={threat.correct ? 'success' : 'danger'}>{threat.correct ? 'Correct' : 'Incorrect'}</Pill>
          </Row>
          <Row label="Class index">
            <span className="font-mono">{threat.classIndex}</span>
          </Row>
          <Row label="Predicted malicious">{threat.isMalicious ? 'Yes' : 'No'}</Row>
        </dl>

        <p className="mt-5 text-xs text-muted">
          These details come from the C++ detection API. Source IP and timestamp are not provided by the current backend.
        </p>
        <Button variant="ghost" className="mt-5 w-full" onClick={onClose}>
          Close
        </Button>
      </GlassPanel>
    </div>
  )
}
