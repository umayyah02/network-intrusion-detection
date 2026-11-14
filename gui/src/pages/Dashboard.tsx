import { useEffect, useMemo, useState } from 'react'
import { Activity, ShieldAlert, ShieldCheck, Target } from 'lucide-react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import {
  AccuracyBars,
  BarTimeline,
  Donut,
  EmptyState,
  ErrorCard,
  Gauge,
  LatestThreatsTable,
  StatCard,
  cumulative,
  toBatches,
} from '../components/charts'
import { GlassPanel, Skeleton } from '../components/ui'
import type { DashboardData, DetectionResult, EvaluationResponse } from '../types/api'

function PanelTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <GlassPanel key={i} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-10 w-full" />
          </GlassPanel>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <GlassPanel key={i}>
            <Skeleton className="h-48 w-full" />
          </GlassPanel>
        ))}
      </div>
      <GlassPanel>
        <Skeleton className="h-40 w-full" />
      </GlassPanel>
    </div>
  )
}

export function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [reload, setReload] = useState(0)

  const [detections, setDetections] = useState<DetectionResult[]>([])
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      try {
        setDashboardLoading(true)
        setDashboardError('')

        const response = await apiFetch(
          endpoints.dashboard,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error(`Dashboard API error: ${response.status}`)
        }

        const data = await response.json()
        if (!controller.signal.aborted) {
          setDashboardData(data)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setDashboardError(
            err instanceof Error ? err.message : 'Failed to load dashboard'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setDashboardLoading(false)
        }
      }
    }

    loadDashboard()

    return () => controller.abort()
  }, [reload])

  // Read-only GETs on existing endpoints, same calls the Threats and Results pages make.
  // Failures are soft: the panels that need them fall back or hide.
  useEffect(() => {
    const controller = new AbortController()

    async function loadExtras() {
      try {
        const res = await apiFetch(endpoints.detections, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          if (!controller.signal.aborted) setDetections(data.items ?? [])
        }
      } catch {
        /* optional panels */
      }
      try {
        const res = await apiFetch(endpoints.metrics, { signal: controller.signal })
        if (res.ok) {
          const data: EvaluationResponse = await res.json()
          if (!controller.signal.aborted) setEvaluation(data)
        }
      } catch {
        /* optional panels */
      }
    }

    loadExtras()
    return () => controller.abort()
  }, [reload])

  const batches = useMemo(() => toBatches(detections), [detections])
  const latestThreats = useMemo(
    () => detections.filter((d) => d.isMalicious).slice(-8).reverse(),
    [detections],
  )
  const avgConfidence = detections.length
    ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
    : null

  const accuracyRows = useMemo(() => {
    const rows: { name: string; value: number }[] = []
    const dt = evaluation?.models.decision_tree?.metrics.accuracy
    const knn = evaluation?.models.knn?.metrics.accuracy
    if (dt !== undefined) rows.push({ name: 'Decision Tree', value: dt })
    if (knn !== undefined) rows.push({ name: 'KNN', value: knn })
    if (rows.length === 0 && dashboardData) {
      rows.push({ name: dashboardData.model, value: dashboardData.accuracy })
    }
    return rows
  }, [evaluation, dashboardData])

  const isEmpty = !dashboardData || dashboardData.totals.total === 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Security overview</h2>
        <p className="text-sm text-muted">Real detection results from the C++ backend.</p>
      </div>

      {dashboardLoading && <DashboardSkeleton />}

      {dashboardError && !dashboardLoading && (
        <ErrorCard message={dashboardError} onRetry={() => setReload((n) => n + 1)} />
      )}

      {!dashboardLoading && !dashboardError && isEmpty && <EmptyState />}

      {dashboardData && !dashboardLoading && !dashboardError && !isEmpty && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total flows"
              value={dashboardData.totals.total.toLocaleString()}
              note="Classified test records, trend by batch"
              icon={Activity}
              spark={cumulative(batches.map((b) => b.total))}
            />
            <StatCard
              title="Normal traffic"
              value={dashboardData.totals.normal.toLocaleString()}
              note="Predicted benign, per batch"
              icon={ShieldCheck}
              spark={batches.map((b) => b.normal)}
            />
            <StatCard
              title="Threats detected"
              value={dashboardData.totals.threats.toLocaleString()}
              note="Predicted malicious, per batch"
              icon={ShieldAlert}
              tone="text-sev-high"
              spark={batches.map((b) => b.threats)}
            />
            <StatCard
              title="Avg. confidence"
              value={avgConfidence === null ? '–' : `${(avgConfidence * 100).toFixed(1)}%`}
              note="Mean model confidence, per batch"
              icon={Target}
              tone="text-teal"
              spark={batches.map((b) => b.avgConfidence)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <GlassPanel>
              <PanelTitle title="Attack types" note="Predicted malicious flows by class" />
              {dashboardData.attackTypes.length > 0 ? (
                <Donut
                  slices={dashboardData.attackTypes.map((a) => ({ name: a.name, value: a.count }))}
                  centerLabel="threats"
                />
              ) : (
                <p className="text-sm text-muted">No attack types in this run.</p>
              )}
            </GlassPanel>

            <GlassPanel>
              <PanelTitle title="Detection rate" note="Share of flows flagged as malicious" />
              <Gauge
                value={dashboardData.totals.total > 0 ? dashboardData.totals.threats / dashboardData.totals.total : 0}
                caption={`${dashboardData.totals.threats.toLocaleString()} of ${dashboardData.totals.total.toLocaleString()} flows`}
              />
            </GlassPanel>

            <GlassPanel>
              <PanelTitle title="Model accuracy" note="From the evaluation report" />
              <AccuracyBars rows={accuracyRows} />
            </GlassPanel>
          </div>

          <GlassPanel>
            <PanelTitle title="Threat activity" note="Threats per detection batch (backend order, not clock time)" />
            {batches.length > 0 ? (
              <BarTimeline batches={batches} />
            ) : (
              <p className="text-sm text-muted">Detection details are not available.</p>
            )}
          </GlassPanel>

          <GlassPanel>
            <PanelTitle
              title="Latest threats"
              note="Last malicious flows in the results. The backend provides no source IP or timestamp."
            />
            {latestThreats.length > 0 ? (
              <LatestThreatsTable threats={latestThreats} />
            ) : (
              <p className="text-sm text-muted">No threats in the stored results.</p>
            )}
          </GlassPanel>

          <p className="text-xs text-muted">
            Dataset: {dashboardData.datasetName} · Model: {dashboardData.model} · Detection completed at:{' '}
            {dashboardData.finishedAt} (UTC)
          </p>
        </>
      )}
    </div>
  )
}
