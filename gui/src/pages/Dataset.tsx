import { useEffect, useState } from 'react'
import { Database, Layers, FlaskConical, Columns3, Search, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '../api/client'
import { throwApiError } from '../api/ApiError'
import { endpoints } from '../api/endpoints'
import { PageHeading } from '../components/PageHeading'
import { EmptyState, ErrorState, StatCard } from '../components/charts'
import { Button, GlassPanel, Pill, Skeleton, cx } from '../components/ui'
import { describeError } from '../lib/describeError'
import type { DatasetItem, DatasetSummary, DatasetPreview } from '../types/api'

export function DatasetPage() {
  const [search, setSearch] = useState('')
  const [dataset, setDataset] = useState('')
  const [datasets, setDatasets] = useState<DatasetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<DatasetSummary | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)

  const [loadingDataset, setLoadingDataset] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [preview, setPreview] = useState<DatasetPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<unknown>(null)

  async function fetchDatasetPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)

    try {
      const response = await apiFetch(endpoints.datasetPreview)
      if (!response.ok) await throwApiError(response, 'Preview')
      const data = await response.json()
      setPreview(data)
    } catch (err) {
      setPreviewError(err)
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    async function loadDatasets() {
      try {
        setLoading(true)
        setError(null)
        const response = await apiFetch(endpoints.datasets, { signal: controller.signal })
        if (!response.ok) await throwApiError(response, 'Datasets')

        const data = await response.json()
        setDatasets(data.datasets)

        const loaded = data.datasets.find((item: { name: string; status: string }) => item.status === 'Loaded')
        setDataset(loaded?.name ?? '')
        const summaryResponse = await apiFetch(endpoints.datasetSummary, { signal: controller.signal })
        if (!summaryResponse.ok) await throwApiError(summaryResponse, 'Summary')

        const summaryData = await summaryResponse.json()
        setSummary(summaryData)
        await fetchDatasetPreview()
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadDatasets()
    return () => controller.abort()
  }, [reload])

  async function handleLoadDataset() {
    if (!dataset || loadingDataset) return

    setLoadingDataset(true)
    setLoadFailed(false)
    setLoadMessage('Loading dataset...')

    try {
      const response = await apiFetch(endpoints.dataset, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dataset }),
      })
      if (!response.ok) await throwApiError(response, 'Dataset')

      const refresh = await apiFetch(endpoints.datasets)
      if (!refresh.ok) await throwApiError(refresh, 'Refresh')

      const data = await refresh.json()
      setDatasets(data.datasets)
      const summaryResponse = await apiFetch(endpoints.datasetSummary)
      if (!summaryResponse.ok) await throwApiError(summaryResponse, 'Summary')

      const summaryData = await summaryResponse.json()
      setSummary(summaryData)
      await fetchDatasetPreview()

      setLoadMessage(`${dataset} loaded successfully!`)
    } catch (err) {
      setLoadFailed(true)
      setLoadMessage(err instanceof Error ? err.message : 'Failed to load dataset')
    } finally {
      setLoadingDataset(false)
    }
  }

  const filtered = datasets.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
  const loadedName = datasets.find((item) => item.status === 'Loaded')?.name

  return (
    <div className="space-y-6">
      <PageHeading
        title="Dataset management"
        description="Review available datasets and prepare network traffic data for analysis."
      />

      {!!error && !loading && <ErrorState error={error} what="datasets" onRetry={() => setReload((n) => n + 1)} />}

      {summary?.loaded && summary.rows && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total records"
            value={summary.rows.total.toLocaleString()}
            note={`Loaded dataset: ${summary.name}`}
            icon={Database}
          />
          <StatCard
            title="Training records"
            value={summary.rows.train.toLocaleString()}
            note="Records used for model training"
            icon={Layers}
            tone="text-teal"
          />
          <StatCard
            title="Testing records"
            value={summary.rows.test.toLocaleString()}
            note="Records reserved for evaluation"
            icon={FlaskConical}
            tone="text-sev-medium"
          />
          {summary.featureCount !== undefined && (
            <StatCard
              title="Features"
              value={String(summary.featureCount)}
              note="Columns used by the models"
              icon={Columns3}
            />
          )}
        </div>
      )}

      {!error && (
        <GlassPanel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                aria-label="Search datasets"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search datasets..."
                className="w-full rounded-xl border border-line bg-void/60 py-3 pl-10 pr-4 text-sm text-fg outline-none placeholder:text-muted focus:border-accent focus-visible:outline-2 focus-visible:outline-accent"
              />
            </div>
            <span className="text-xs text-muted">
              {loading ? 'Loading…' : `${datasets.length} datasets reported by the C++ backend.`} Select one and click Load Selected Dataset to activate it.
            </span>
          </div>

          <div className="mt-5 max-h-96 space-y-2 overflow-y-auto pr-1" aria-busy={loading || undefined}>
            {loading &&
              Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}

            {!loading &&
              filtered.map((item) => {
                const selected = dataset === item.name
                return (
                  <button
                    key={item.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDataset(item.name)}
                    className={cx(
                      'flex w-full flex-col justify-between gap-2 rounded-xl border p-4 text-left transition sm:flex-row sm:items-center',
                      'focus-visible:outline-2 focus-visible:outline-accent',
                      selected ? 'border-accent bg-accent-soft shadow-glow' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        Records: {item.records === null ? 'Not loaded' : item.records.toLocaleString()} · Features:{' '}
                        {item.features === null ? 'Not loaded' : item.features}
                      </p>
                    </div>
                    <Pill tone={item.status === 'Loaded' ? 'success' : 'neutral'} className="w-fit">
                      {item.status}
                    </Pill>
                  </button>
                )
              })}

            {!loading && filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">No matching datasets found.</p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button onClick={handleLoadDataset} disabled={!dataset} loading={loadingDataset}>
              {loadingDataset ? 'Loading...' : 'Load Selected Dataset'}
            </Button>
            {loadMessage && (
              <p
                role="status"
                className={cx('flex items-center gap-2 text-sm', loadFailed ? 'text-sev-high-fg' : 'text-muted')}
              >
                {!loadFailed && !loadingDataset && <CheckCircle2 size={16} className="text-accent" aria-hidden="true" />}
                {loadMessage}
              </p>
            )}
          </div>

          <p className="mt-5 text-xs text-muted">
            Selected dataset: <span className="font-mono text-accent">{dataset || 'None'}</span>
            {' · '}
            Loaded in backend: <span className="font-mono text-teal">{loadedName ?? 'None'}</span>
          </p>
        </GlassPanel>
      )}

      <GlassPanel>
        <h3 className="text-lg font-semibold">CSV dataset preview</h3>
        <p className="mt-1 text-sm text-muted">Preview of actual CSV records returned by the C++ backend.</p>

        {previewLoading && (
          <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading CSV preview">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {!previewLoading && !!previewError && <PreviewProblem error={previewError} />}

        {!previewLoading && !previewError && preview && (
          <>
            <p className="mt-4 text-sm">
              Dataset: <span className="font-mono text-accent">{preview.datasetName}</span>
              {' · '}Showing {preview.rows.length} rows
              {' · '}
              {preview.columns.length} columns
            </p>

            <div className="mt-4 max-h-[500px] overflow-auto rounded-xl border border-line">
              <table className="min-w-max text-left text-xs">
                <thead className="sticky top-0 bg-panel-solid text-muted">
                  <tr>
                    {preview.columns.map((column, index) => (
                      <th key={index} className="whitespace-nowrap border-r border-line px-4 py-3 font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-line hover:bg-accent-soft">
                      {preview.columns.map((_, columnIndex) => (
                        <td key={columnIndex} className="whitespace-nowrap border-r border-line px-4 py-2.5 font-mono">
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
          <p className="mt-4 text-sm text-muted">No CSV preview available.</p>
        )}
      </GlassPanel>
    </div>
  )
}

/** No dataset yet is a step to do, not a failure. */
function PreviewProblem({ error }: { error: unknown }) {
  const v = describeError(error, 'the CSV preview')
  if (v.kind === 'setup')
    return <EmptyState title={v.title} body="Select a dataset above and load it to see a preview." cta={false} />
  return (
    <p role="alert" className="mt-4 text-sm text-sev-high-fg">
      {v.title}: {v.body}
    </p>
  )
}
