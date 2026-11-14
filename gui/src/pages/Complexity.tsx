import { useEffect, useState } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import { throwApiError } from '../api/ApiError'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { EmptyState, ErrorCard, ErrorState } from '../components/charts/PanelStates'
import { PageHeading } from '../components/PageHeading'
import { Button, GlassPanel, Skeleton, cx } from '../components/ui'
import { describeError } from '../lib/describeError'
import type { ComplexityMetric, ComplexityModel, ComplexityResponse } from '../types/api'

const POLL_MS = 3000

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'min-h-11 rounded-xl border px-4 text-sm font-medium transition',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            value === option.value
              ? 'border-transparent bg-accent text-accent-fg shadow-glow'
              : 'border-line-strong text-muted hover:bg-accent-soft hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Tile({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <GlassPanel>
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-3 font-mono text-2xl font-semibold">{value}</p>
      <p className="mt-3 text-xs text-muted">{note}</p>
    </GlassPanel>
  )
}

function ComplexitySkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading complexity results...</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <GlassPanel key={item} className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </GlassPanel>
        ))}
      </div>
      <GlassPanel>
        <Skeleton className="h-80 w-full" />
      </GlassPanel>
    </div>
  )
}

export function ComplexityPage() {
  const [selectedModel, setSelectedModel] = useState<ComplexityModel>('decision_tree')
  const [metric, setMetric] = useState<ComplexityMetric>('predictMs')
  const [data, setData] = useState<ComplexityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [starting, setStarting] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [runError, setRunError] = useState<unknown>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const response = await apiFetch(endpoints.complexity, { signal: controller.signal })
        if (!response.ok) await throwApiError(response, 'Complexity')
        const result: ComplexityResponse = await response.json()
        if (!controller.signal.aborted) setData(result)
      } catch (err) {
        if (!controller.signal.aborted) setError(err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [reloadKey])

  // After a benchmark is started, check for results every few seconds until it is ready.
  useEffect(() => {
    if (!waiting) return
    const controller = new AbortController()

    const interval = setInterval(async () => {
      try {
        const response = await apiFetch(endpoints.complexity, { signal: controller.signal })
        if (!response.ok) await throwApiError(response, 'Complexity')
        const result: ComplexityResponse = await response.json()
        if (result.ready) {
          setData(result)
          setWaiting(false)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setWaiting(false)
          setError(err)
        }
      }
    }, POLL_MS)

    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [waiting])

  async function runBenchmarks() {
    if (starting || waiting) return

    setStarting(true)
    setRunError(null)

    try {
      const response = await apiFetch(endpoints.complexityRun, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) await throwApiError(response, 'Benchmark')

      setData((previous) => (previous ? { ...previous, ready: false, runs: [] } : null))
      setWaiting(true)
    } catch (err) {
      setRunError(err)
    } finally {
      setStarting(false)
    }
  }

  const runs = data?.ready ? data.runs : []
  const selectedRuns = runs
    .filter((item) => item.model === selectedModel)
    .sort((a, b) => a.trainRows - b.trainRows)

  const fullRun = selectedRuns.length > 0 ? selectedRuns[selectedRuns.length - 1] : undefined

  const chartData = Array.from(new Set(runs.map((item) => item.trainRows)))
    .sort((a, b) => a - b)
    .map((records) => ({
      records,
      tree:
        runs.find((item) => item.model === 'decision_tree' && item.trainRows === records)?.[
          metric
        ] ?? null,
      knn:
        runs.find((item) => item.model === 'knn' && item.trainRows === records)?.[metric] ??
        null,
    }))

  const theory = data?.theory[selectedModel]
  const modelName = selectedModel === 'decision_tree' ? 'Decision Tree' : 'KNN'

  const runView = runError ? describeError(runError, 'the benchmark') : null
  const runMessage = runView
    ? runView.kind === 'error'
      ? runView.body
      : `${runView.title}. ${runView.body}`
    : ''

  return (
    <div className="space-y-6">
      <PageHeading
        title="Complexity analysis"
        description="Measured C++ execution times and theoretical algorithm complexity."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh benchmarks'}
        </Button>
        <Button
          onClick={runBenchmarks}
          loading={starting || waiting}
          disabled={loading}
        >
          {starting ? 'Starting...' : waiting ? 'Running...' : 'Run new benchmark'}
        </Button>
      </div>

      {runView && (
        <ErrorCard
          title="Could not start the benchmark"
          message={runMessage}
          onRetry={runBenchmarks}
        />
      )}

      {waiting && (
        <GlassPanel role="status">
          <p className="font-semibold">Benchmark running</p>
          <p className="mt-1 text-sm text-muted">
            Results appear here when it finishes. Checking every {POLL_MS / 1000} seconds.
          </p>
        </GlassPanel>
      )}

      {loading && <ComplexitySkeleton />}

      {!loading && error != null && (
        <ErrorState
          error={error}
          what="benchmarks"
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {!loading && error == null && !data && !waiting && (
        <EmptyState
          title="No benchmark results"
          body="Run a new benchmark to measure training and prediction times."
          cta={false}
        />
      )}

      {!loading && error == null && data && !data.ready && !waiting && (
        <GlassPanel className="border-sev-medium/30">
          <p className="text-sev-medium-fg">
            Benchmarks are not ready yet. If a benchmark job is running, wait for completion
            and click Refresh benchmarks.
          </p>
        </GlassPanel>
      )}

      {!loading && error == null && data && (
        <p className="text-sm text-muted">
          Dataset: {data.datasetName ?? 'Not available'}
          {' · '}Repeats: {data.repeats ?? 'N/A'}
          {' · '}Measured on the backend server
        </p>
      )}

      {!loading && error == null && data?.ready && (
        <>
          <Toggle<ComplexityModel>
            label="Model"
            value={selectedModel}
            onChange={setSelectedModel}
            options={[
              { value: 'decision_tree', label: 'Decision Tree' },
              { value: 'knn', label: 'KNN' },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              title="Training time"
              value={fullRun ? `${fullRun.trainMs.toFixed(3)} ms` : 'N/A'}
              note={`${modelName} · largest measured training size`}
            />
            <Tile
              title="Prediction time"
              value={fullRun ? `${fullRun.predictMs.toFixed(3)} ms` : 'N/A'}
              note={`${fullRun?.testRows ?? 0} test records`}
            />
            <Tile
              title="Training records"
              value={fullRun ? fullRun.trainRows.toLocaleString() : 'N/A'}
              note="Largest measured training subset"
            />
            <Tile
              title="Memory usage"
              value={
                fullRun?.memoryBytes == null
                  ? 'N/A'
                  : `${(fullRun.memoryBytes / 1048576).toFixed(2)} MB`
              }
              note="Not measured when unavailable"
            />
          </div>

          <GlassPanel>
            <h3 className="font-semibold">Scalability comparison</h3>
            <p className="mt-2 text-sm text-muted">
              Actual server measurements across training dataset sizes.
            </p>

            <div className="mt-4">
              <Toggle<ComplexityMetric>
                label="Metric"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'predictMs', label: 'Prediction time' },
                  { value: 'trainMs', label: 'Training time' },
                ]}
              />
            </div>

            {chartData.length > 0 ? (
              <div className="mt-6 h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid stroke="#1b3a31" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="records"
                      domain={['dataMin', 'dataMax']}
                      stroke="#8fb3a6"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="#8fb3a6" tick={{ fontSize: 11 }} unit=" ms" width={75} />
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value).toFixed(3)} ms`,
                        String(name),
                      ]}
                      contentStyle={{
                        backgroundColor: '#0a2019',
                        border: '1px solid rgb(52 211 153 / 0.4)',
                        borderRadius: 12,
                        color: '#e6f5ef',
                      }}
                      labelStyle={{ color: '#8fb3a6' }}
                    />
                    <Legend />
                    <Line
                      type="linear"
                      dataKey="tree"
                      name="Decision Tree"
                      stroke="#34d399"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="linear"
                      dataKey="knn"
                      name="KNN"
                      stroke="#fbbf24"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      dot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-5 text-muted">No benchmark points available.</p>
            )}

            <p className="mt-3 text-xs text-muted">
              X-axis: training records · Y-axis: measured wall-clock time (ms). Each prediction
              run uses the full test split. Decision Tree is the solid green line, KNN the dashed
              amber line.
            </p>
          </GlassPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel>
              <h3 className="font-semibold">Time complexity</h3>
              <p className="mt-3 text-sm">Training: {theory?.train}</p>
              <p className="mt-3 text-sm">Prediction: {theory?.predict}</p>
            </GlassPanel>

            <GlassPanel>
              <h3 className="font-semibold">Space complexity</h3>
              <p className="mt-3 text-sm">{theory?.storage}</p>
              <p className="mt-3 text-xs text-muted">
                Theoretical storage complexity is not a measured RAM value.
              </p>
            </GlassPanel>
          </div>

          <p className="text-xs text-muted">{data.notes}</p>
        </>
      )}
    </div>
  )
}
