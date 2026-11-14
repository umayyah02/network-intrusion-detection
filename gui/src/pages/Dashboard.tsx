import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { MetricCard } from '../components/MetricCard'
import { PageHeading } from '../components/PageHeading'
import type { DashboardData } from '../types/api'

export function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  
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
  }, [])

  
  return (
    <div className="space-y-6">
      <PageHeading
        title="Security overview"
        description="Real detection results from the C++ backend."
      />

      {dashboardLoading && (
        <p className="text-cyan-300">Loading dashboard...</p>
      )}

      {dashboardError && (
        <p className="text-red-400">{dashboardError}</p>
      )}

      {!dashboardLoading && !dashboardError && !dashboardData && (
        <p className="text-slate-400">
          No dashboard results available.
        </p>
      )}

      {dashboardData && !dashboardLoading && !dashboardError && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Records Analyzed"
              value={dashboardData.totals.total.toLocaleString()}
              note="Classified test records"
              icon="⇄"
              color="bg-cyan-500/10 text-cyan-300"
            />
            <MetricCard
              title="Threats Detected"
              value={dashboardData.totals.threats.toLocaleString()}
              note="Predicted malicious records"
              icon="⚠"
              color="bg-red-500/10 text-red-300"
            />
            <MetricCard
              title="Normal Traffic"
              value={dashboardData.totals.normal.toLocaleString()}
              note="Predicted benign records"
              icon="◉"
              color="bg-emerald-500/10 text-emerald-300"
            />
            <MetricCard
              title="Model Accuracy"
              value={`${(dashboardData.accuracy * 100).toFixed(2)}%`}
              note="Backend-reported accuracy"
              icon="✓"
              color="bg-violet-500/10 text-violet-300"
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="font-semibold text-white">
              Attack Type Distribution
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Dataset: {dashboardData.datasetName} · Model: {dashboardData.model}
            </p>

            <div className="mt-6 space-y-4">
              {dashboardData.attackTypes.map((attack) => (
                <div key={attack.name}>
                  <div className="mb-2 flex justify-between text-sm text-slate-300">
                    <span>{attack.name}</span>
                    <span>{attack.count} records</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{
                        width: `${
                          dashboardData.totals.threats > 0
                            ? (attack.count / dashboardData.totals.threats) * 100
                            : 0
                        }%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Detection completed at: {dashboardData.finishedAt} (UTC)
          </p>
        </>
      )}
    </div>
  )
}
