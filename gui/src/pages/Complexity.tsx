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
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { MetricCard } from '../components/MetricCard'
import { PageHeading } from '../components/PageHeading'
import type { ComplexityModel, ComplexityMetric, ComplexityResponse } from '../types/api'

export function ComplexityPage() {
  const [selectedModel, setSelectedModel] =
    useState<ComplexityModel>('decision_tree')
  const [metric, setMetric] = useState<ComplexityMetric>('predictMs')
  const [data, setData] = useState<ComplexityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  async function loadComplexity() {
    const response = await apiFetch(endpoints.complexity)

    if (!response.ok) {
      throw new Error(`Complexity API error: ${response.status}`)
    }

    const result: ComplexityResponse = await response.json()
    setData(result)
    return result
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const response = await apiFetch(endpoints.complexity)

        if (!response.ok) {
          throw new Error(`Complexity API error: ${response.status}`)
        }

        const result: ComplexityResponse = await response.json()
        if (active) setData(result)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load benchmarks')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [])

  async function runBenchmarks() {
    if (running) return

    setRunning(true)
    setError('')

    try {
      const response = await apiFetch(
        endpoints.complexityRun,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }
      )

      if (!response.ok) {
        throw new Error(`Benchmark start failed: ${response.status}`)
      }

      setData((previous) =>
        previous ? { ...previous, ready: false, runs: [] } : null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start benchmark')
    } finally {
      setRunning(false)
    }
  }

  async function refreshBenchmarks() {
    setLoading(true)
    setError('')

    try {
      await loadComplexity()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh benchmarks')
    } finally {
      setLoading(false)
    }
  }

  const runs = data?.ready ? data.runs : []
  const selectedRuns = runs
    .filter((item) => item.model === selectedModel)
    .sort((a, b) => a.trainRows - b.trainRows)

  const fullRun = selectedRuns.length > 0
    ? selectedRuns[selectedRuns.length - 1]
    : undefined

  const chartData = Array.from(new Set(runs.map((item) => item.trainRows)))
    .sort((a, b) => a - b)
    .map((records) => ({
      records,
      tree: runs.find(
        (item) => item.model === 'decision_tree' && item.trainRows === records
      )?.[metric] ?? null,
      knn: runs.find(
        (item) => item.model === 'knn' && item.trainRows === records
      )?.[metric] ?? null
    }))

  const theory = data?.theory[selectedModel]
  const modelName = selectedModel === 'decision_tree' ? 'Decision Tree' : 'KNN'

  return (
    <div className="space-y-6">
      <PageHeading
        title="Complexity analysis"
        description="Measured C++ execution times and theoretical algorithm complexity."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={refreshBenchmarks}
          disabled={loading}
          className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-white disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh benchmarks'}
        </button>

        <button
          onClick={runBenchmarks}
          disabled={running || loading}
          className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {running ? 'Starting...' : 'Run new benchmark'}
        </button>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      {loading && <p className="text-cyan-300">Loading complexity results...</p>}

      {!loading && data && !data.ready && (
        <p className="rounded-xl border border-amber-500/30 p-5 text-amber-300">
          Benchmarks are not ready yet. If a benchmark job is running,
          wait for completion and click Refresh benchmarks.
        </p>
      )}

      {data && (
        <p className="text-sm text-slate-400">
          Dataset: {data.datasetName ?? 'Not available'}
          {' · '}Repeats: {data.repeats ?? 'N/A'}
          {' · '}Measured on the backend server
        </p>
      )}

      {data?.ready && (
        <>
          <div className="flex flex-wrap gap-3">
            {(['decision_tree', 'knn'] as ComplexityModel[]).map((model) => (
              <button
                key={model}
                onClick={() => setSelectedModel(model)}
                className={`rounded-xl px-5 py-3 text-sm font-medium ${
                  selectedModel === model
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                {model === 'decision_tree' ? 'Decision Tree' : 'KNN'}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Training time"
              value={fullRun ? `${fullRun.trainMs.toFixed(3)} ms` : 'N/A'}
              note={`${modelName} · largest measured training size`}
              icon="◷"
              color="bg-cyan-500/10 text-cyan-300"
            />
            <MetricCard
              title="Prediction time"
              value={fullRun ? `${fullRun.predictMs.toFixed(3)} ms` : 'N/A'}
              note={`${fullRun?.testRows ?? 0} test records`}
              icon="⚡"
              color="bg-violet-500/10 text-violet-300"
            />
            <MetricCard
              title="Training records"
              value={fullRun ? fullRun.trainRows.toLocaleString() : 'N/A'}
              note="Largest measured training subset"
              icon="▤"
              color="bg-emerald-500/10 text-emerald-300"
            />
            <MetricCard
              title="Memory usage"
              value={
                fullRun?.memoryBytes == null
                  ? 'N/A'
                  : `${(fullRun.memoryBytes / 1048576).toFixed(2)} MB`
              }
              note="Not measured when unavailable"
              icon="▦"
              color="bg-amber-500/10 text-amber-300"
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="font-semibold text-white">Scalability comparison</h3>
            <p className="mt-2 text-sm text-slate-400">
              Actual server measurements across training dataset sizes.
            </p>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setMetric('predictMs')}
                className={`rounded-lg px-4 py-2 text-sm ${
                  metric === 'predictMs'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-slate-700 text-slate-300'
                }`}
              >
                Prediction time
              </button>
              <button
                onClick={() => setMetric('trainMs')}
                className={`rounded-lg px-4 py-2 text-sm ${
                  metric === 'trainMs'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'border border-slate-700 text-slate-300'
                }`}
              >
                Training time
              </button>
            </div>

            {chartData.length > 0 ? (
              <div className="mt-6 h-80 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid stroke="#203047" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="records"
                      domain={['dataMin', 'dataMax']}
                      stroke="#7186a2"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#7186a2"
                      tick={{ fontSize: 11 }}
                      unit=" ms"
                      width={75}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${Number(value).toFixed(3)} ms`,
                        String(name)
                      ]}
                      contentStyle={{
                        backgroundColor: '#0c192b',
                        border: '1px solid #28405a',
                        borderRadius: 10
                      }}
                    />
                    <Legend />
                    <Line
                      type="linear"
                      dataKey="tree"
                      name="Decision Tree"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="linear"
                      dataKey="knn"
                      name="KNN"
                      stroke="#a78bfa"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-5 text-slate-400">No benchmark points available.</p>
            )}

            <p className="mt-3 text-xs text-slate-500">
              X-axis: training records · Y-axis: measured wall-clock time (ms).
              Each prediction run uses the full test split.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="font-semibold text-white">Time complexity</h3>
              <p className="mt-3 text-sm text-slate-300">
                Training: {theory?.train}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                Prediction: {theory?.predict}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="font-semibold text-white">Space complexity</h3>
              <p className="mt-3 text-sm text-slate-300">
                {theory?.storage}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Theoretical storage complexity is not a measured RAM value.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {data.notes}
          </p>
        </>
      )}
    </div>
  )
}
