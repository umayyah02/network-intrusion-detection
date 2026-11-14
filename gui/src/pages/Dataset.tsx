import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { MetricCard } from '../components/MetricCard'
import { PageHeading } from '../components/PageHeading'
import type { DatasetItem, DatasetSummary, DatasetPreview } from '../types/api'

export function DatasetPage() {
  const [search, setSearch] = useState('')

  const [dataset, setDataset] = useState('')

const [datasets, setDatasets] = useState<DatasetItem[]>([])

const [loading, setLoading] = useState(true)
const [summary, setSummary] = useState<DatasetSummary | null>(null)
const [error, setError] = useState('')



const [loadingDataset, setLoadingDataset] = useState(false)
const [loadMessage, setLoadMessage] = useState('')
const [preview, setPreview] = useState<DatasetPreview | null>(null)

const [previewLoading, setPreviewLoading] = useState(false)
const [previewError, setPreviewError] = useState('')
async function fetchDatasetPreview() {
  setPreviewLoading(true)
  setPreviewError('')
  setPreview(null)

  try {
    const response = await apiFetch(
      endpoints.datasetPreview
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.error?.message ?? `Preview API error: ${response.status}`
      )
    }

    const data = await response.json()
    setPreview(data)
  } catch (err) {
    setPreviewError(
      err instanceof Error ? err.message : 'Failed to load CSV preview'
    )
  } finally {
    setPreviewLoading(false)
  }
}

useEffect(() => {
  const controller = new AbortController()

  async function loadDatasets() {
    try {
      const response = await apiFetch(endpoints.datasets, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      setDatasets(data.datasets)

      const loaded = data.datasets.find(
        (item: { name: string; status: string }) => item.status === 'Loaded'
      )
      setDataset(loaded?.name ?? '')
      const summaryResponse = await apiFetch(
        endpoints.datasetSummary,
        { signal: controller.signal }
      )

      if (!summaryResponse.ok) {
        throw new Error(`Summary API error: ${summaryResponse.status}`)
      }

      const summaryData = await summaryResponse.json()
      setSummary(summaryData)
      await fetchDatasetPreview()
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load datasets')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  loadDatasets()

  return () => controller.abort()
}, [])
async function handleLoadDataset() {
  if (!dataset || loadingDataset) return

  setLoadingDataset(true)
  setLoadMessage('Loading dataset...')

  try {
    const response = await apiFetch(endpoints.dataset, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: dataset }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.error?.message ?? `API error: ${response.status}`
      )
    }

    const refresh = await apiFetch(endpoints.datasets)

    if (!refresh.ok) {
      throw new Error(`Refresh error: ${refresh.status}`)
    }

    const data = await refresh.json()
    setDatasets(data.datasets)
    const summaryResponse = await apiFetch(
      endpoints.datasetSummary
    )

    if (!summaryResponse.ok) {
      throw new Error(`Summary API error: ${summaryResponse.status}`)
    }

    const summaryData = await summaryResponse.json()
    setSummary(summaryData)
    await fetchDatasetPreview()
    
    setLoadMessage(`${dataset} loaded successfully!`)
  } catch (err) {
    setLoadMessage(
      err instanceof Error ? err.message : 'Failed to load dataset'
    )
  } finally {
    setLoadingDataset(false)
  }
}
  const filtered = datasets.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <PageHeading
        title="Dataset management"
        description="Review available datasets and prepare network traffic data for analysis."
      />
          {summary?.loaded && summary.rows && (
      <div className="mb-6 grid gap-4 sm:grid-cols-1">
        <MetricCard
          title="Total Records"
          value={summary.rows.total.toLocaleString()}
          note={`Loaded dataset: ${summary.name}`}
          icon="▤"
          color="bg-cyan-500/10 text-cyan-300"
        />

        <MetricCard
          title="Training Records"
          value={summary.rows.train.toLocaleString()}
          note="Records used for model training"
          icon="⚙"
          color="bg-emerald-500/10 text-emerald-300"
        />

        <MetricCard
          title="Testing Records"
          value={summary.rows.test.toLocaleString()}
          note="Records reserved for evaluation"
          icon="✓"
          color="bg-violet-500/10 text-violet-300"
        />
      </div>
    )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Available datasets"
          value={loading ? '...' : error ? 'Unavailable' : String(datasets.length)}
          note="Datasets reported by C++ backend"
          icon="▤"
          color="bg-cyan-500/10 text-cyan-300"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search datasets..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500 sm:max-w-sm"
          />
          <span className="text-xs text-slate-500">
            Select a dataset and click Load Selected Dataset to activate it.
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {loading && (
            <p className="text-sm text-cyan-300">
              Loading datasets from backend...
            </p>
          )}

          {error && (
            <p className="text-sm text-red-400">
              Failed to connect to backend: {error}
            </p>
          )}
          {filtered.map((item) => (
            <button
              key={item.name}
              onClick={() => setDataset(item.name)}
              className={`flex w-full flex-col justify-between gap-3 rounded-xl border p-4 text-left transition sm:flex-row sm:items-center ${
                dataset === item.name
                  ? 'border-cyan-500/50 bg-cyan-500/5'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
              }`}
            >
              <div>
                <p className="font-medium text-white">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Records: {item.records === null ? 'Not loaded' : item.records.toLocaleString()} · Features: {item.features === null ? 'Not loaded' : item.features}
                </p>
              </div>
              <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                {item.status}
              </span>
            </button>
          ))}
          {!loading && !error && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No matching datasets found.</p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={handleLoadDataset}
            disabled={!dataset || loadingDataset}
            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingDataset ? 'Loading...' : 'Load Selected Dataset'}
          </button>

          {loadMessage && (
            <p className="text-sm text-slate-300">{loadMessage}</p>
          )}
        </div>
        <p className="mt-5 text-xs text-slate-500">
          Selected dataset: <span className="text-cyan-300">{dataset || 'None'}</span>
          {' · '}
          Loaded in backend: <span className="text-emerald-300">
            {datasets.find((item) => item.status === 'Loaded')?.name ?? 'None'}
          </span>
        </p>
            </div>

      {/* Real CSV Dataset Preview */}
      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="text-lg font-semibold text-white">
          CSV Dataset Preview
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          Preview of actual CSV records returned by the C++ backend.
        </p>

        {previewLoading && (
          <p className="mt-4 text-cyan-300">
            Loading CSV preview...
          </p>
        )}

        {previewError && (
          <p className="mt-4 text-red-400">
            {previewError}
          </p>
        )}

        {!previewLoading && !previewError && preview && (
          <>
            <p className="mt-4 text-sm text-slate-300">
              Dataset: <span className="text-cyan-300">{preview.datasetName}</span>
              {' · '}Showing {preview.rows.length} rows
              {' · '}{preview.columns.length} columns
            </p>

            <div className="mt-5 max-h-[500px] overflow-auto rounded-xl border border-slate-800">
              <table className="min-w-max text-left text-xs">
                <thead className="sticky top-0 bg-slate-800 text-slate-200">
                  <tr>
                    {preview.columns.map((column, index) => (
                      <th
                        key={index}
                        className="whitespace-nowrap border-r border-slate-700 px-4 py-3 font-semibold"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {preview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-800/40">
                      {preview.columns.map((_, columnIndex) => (
                        <td
                          key={columnIndex}
                          className="whitespace-nowrap border-r border-slate-800 px-4 py-3 text-slate-300"
                        >
                          {row[columnIndex] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!previewLoading && !previewError && !preview && (
          <p className="mt-4 text-slate-400">
            No CSV preview available.
          </p>
        )}
      </div>
    </div>
  )
}
