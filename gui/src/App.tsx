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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080'



type Page =
  | 'Dashboard'
  | 'Dataset'
  | 'Detection'
  | 'Threats'
  | 'Results & Evaluation'
  | 'Complexity Analysis'



const pages: { name: Page; icon: string }[] = [
  { name: 'Dashboard', icon: '▦' },
  { name: 'Dataset', icon: '▤' },
  { name: 'Detection', icon: '⌁' },
  { name: 'Threats', icon: '⚠' },
  { name: 'Results & Evaluation', icon: '◫' },
  { name: 'Complexity Analysis', icon: '⌘' },
]



type DetectionResult = {
  id: number | string
  label: string
  classIndex: number
  isMalicious: boolean
  confidence: number
  actualLabel: string
  correct: boolean
  severity?: 'Low' | 'Medium' | 'High'
}




function MetricCard({
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



function PageHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-7">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  )
}


function Dashboard() {
  const [dashboardData, setDashboardData] = useState<{
    accuracy: number
    attackTypes: {
      name: string
      count: number
    }[]
    datasetName: string
    finishedAt: string
    model: string
    totals: {
      normal: number
      threats: number
      total: number
    }
  } | null>(null)

  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  
  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      try {
        setDashboardLoading(true)
        setDashboardError('')

        const response = await fetch(
          `${API_BASE_URL}/api/dashboard`,
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



function DatasetPage() {
  const [search, setSearch] = useState('')

  const [dataset, setDataset] = useState('')

const [datasets, setDatasets] = useState<{
  name: string
  records: number | null
  features: number | null
  status: string
}[]>([])

const [loading, setLoading] = useState(true)
const [summary, setSummary] = useState<{
  loaded: boolean
  name?: string
  rows?: {
    total: number
    train: number
    test: number
  }
  featureCount?: number
  classes?: {
    index: number
    name: string
    total: number
    train: number
    test: number
  }[]
} | null>(null)
const [error, setError] = useState('')



const [loadingDataset, setLoadingDataset] = useState(false)
const [loadMessage, setLoadMessage] = useState('')
const [preview, setPreview] = useState<{
  datasetName: string
  columns: string[]
  rows: string[][]
  previewRows: number
  totalRows: number | null
} | null>(null)

const [previewLoading, setPreviewLoading] = useState(false)
const [previewError, setPreviewError] = useState('')
async function fetchDatasetPreview() {
  setPreviewLoading(true)
  setPreviewError('')
  setPreview(null)

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/dataset/preview?limit=20`
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
      const response = await fetch(`${API_BASE_URL}/api/datasets`, {
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
      const summaryResponse = await fetch(
        `${API_BASE_URL}/api/dataset/summary`,
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
    const response = await fetch(`${API_BASE_URL}/api/dataset`, {
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

    const refresh = await fetch(`${API_BASE_URL}/api/datasets`)

    if (!refresh.ok) {
      throw new Error(`Refresh error: ${refresh.status}`)
    }

    const data = await refresh.json()
    setDatasets(data.datasets)
    const summaryResponse = await fetch(
      `${API_BASE_URL}/api/dataset/summary`
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


type RetainedModelInfo = {
  name: string
  status: string
  trainedOn: string
  trainedAt: string
  params?: Record<string, unknown>
  features: number
  trainRows: number
  testAccuracy?: number
  testMacroF1?: number
}

function DetectionPage() {
  const [activeWorkflow, setActiveWorkflow] = useState<'train' | 'predict'>('train')
  const [demoMessage, setDemoMessage] = useState('No detection or inference job has been run.')
  const [selectedModel, setSelectedModel] = useState<'decision_tree' | 'knn'>('decision_tree')
  const [knnDistance, setKnnDistance] = useState<'euclidean' | 'manhattan'>('euclidean')
  const [runningDetection, setRunningDetection] = useState(false)
  const [detectionProgress, setDetectionProgress] = useState(0)
  const [pollingDetection, setPollingDetection] = useState(false)
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([])
  const [detectionMeta, setDetectionMeta] = useState<{
    model?: string
    datasetName?: string
    trainedOn?: string
    evaluatedOn?: string
    mode?: string
    total?: number
  } | null>(null)

  // State for trained models & predict workflow
  const [trainedModels, setTrainedModels] = useState<RetainedModelInfo[]>([])
  const [selectedServerFile, setSelectedServerFile] = useState('')
  const [serverFiles, setServerFiles] = useState<string[]>([])
  const [uploadEvalFile, setUploadEvalFile] = useState<File | null>(null)
  const [evalSource, setEvalSource] = useState<'server' | 'upload'>('server')
  const [loadedDatasetName, setLoadedDatasetName] = useState<string>('')

  useEffect(() => {
    fetchTrainedModels()
    fetchServerFiles()
    fetchLoadedDataset()
  }, [])

  useEffect(() => {
    if (!pollingDetection) return

    const interval = setInterval(() => {
      checkDetectionStatus()
    }, 500)

    return () => clearInterval(interval)
  }, [pollingDetection])

  async function fetchTrainedModels() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/models`)
      if (res.ok) {
        const data = await res.json()
        setTrainedModels(data.models ?? [])
      }
    } catch {
      // ignore
    }
  }

  async function fetchServerFiles() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/dataset/files`)
      if (res.ok) {
        const data = await res.json()
        const paths = (data.files ?? []).map((f: { path: string }) => f.path)
        setServerFiles(paths)
        if (paths.length > 0 && !selectedServerFile) {
          const pref = paths.find((p: string) => p.includes('held_DDoS')) ?? paths[0]
          setSelectedServerFile(pref)
        }
      }
    } catch {
      // ignore
    }
  }

  async function fetchLoadedDataset() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/datasets`)
      if (res.ok) {
        const data = await res.json()
        const loaded = (data.datasets ?? []).find(
          (d: { status: string }) => d.status === 'Loaded'
        )
        if (loaded) setLoadedDatasetName(loaded.name)
      }
    } catch {
      // ignore
    }
  }

  async function fetchDetectionResults() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/detections`)

      if (!response.ok) {
        throw new Error(`Detections API error: ${response.status}`)
      }

      const data = await response.json()
      setDetectionResults(data.items ?? [])
      setDetectionMeta({
        model: data.model,
        datasetName: data.datasetName,
        trainedOn: data.trainedOn,
        evaluatedOn: data.evaluatedOn,
        mode: data.mode,
        total: data.total,
      })
    } catch (err) {
      setDemoMessage(
        err instanceof Error ? err.message : 'Failed to fetch detection results'
      )
    }
  }

  async function checkDetectionStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/detect/status`)

      if (!response.ok) {
        throw new Error(`Status API error: ${response.status}`)
      }

      const data = await response.json()

      setDetectionProgress(data.progress ?? 0)
      setDemoMessage(data.message ?? 'Job is running...')

      if (data.state === 'done') {
        setRunningDetection(false)
        setPollingDetection(false)
        setDetectionProgress(1)
        setDemoMessage('Completed successfully!')
        await fetchDetectionResults()
        await fetchTrainedModels()
      }

      if (data.state === 'failed') {
        setRunningDetection(false)
        setPollingDetection(false)
        setDemoMessage(data.message ?? 'Job failed.')
      }
    } catch (err) {
      setRunningDetection(false)
      setPollingDetection(false)
      setDemoMessage(
        err instanceof Error ? err.message : 'Failed to check status'
      )
    }
  }

  async function handleRunTrainAndEvaluate() {
    if (runningDetection) return

    setRunningDetection(true)
    setDetectionProgress(0)
    setDemoMessage('Starting model training...')

    try {
      const params: Record<string, unknown> = {}
      if (selectedModel === 'knn') {
        params.p = knnDistance === 'manhattan' ? 1.0 : 2.0
        params.k = 1
      }

      const response = await fetch(`${API_BASE_URL}/api/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          params: Object.keys(params).length > 0 ? params : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message ?? `API error: ${response.status}`)
      }

      setDemoMessage(
        `${selectedModel === 'decision_tree' ? 'Decision Tree' : 'KNN'} training started successfully.`
      )
      setPollingDetection(true)
    } catch (err) {
      setDemoMessage(err instanceof Error ? err.message : 'Failed to start training')
      setRunningDetection(false)
      setPollingDetection(false)
    }
  }

  async function handleRunPredict() {
    if (runningDetection) return

    setRunningDetection(true)
    setDetectionProgress(0)
    setDemoMessage('Starting inference on test dataset...')

    try {
      let response: Response
      if (evalSource === 'upload') {
        if (!uploadEvalFile) {
          throw new Error('Please select a CSV file to upload for evaluation.')
        }
        const formData = new FormData()
        formData.append('file', uploadEvalFile)
        formData.append('model', selectedModel)

        response = await fetch(`${API_BASE_URL}/api/predict`, {
          method: 'POST',
          body: formData,
        })
      } else {
        if (!selectedServerFile) {
          throw new Error('Please select an evaluation dataset from the list.')
        }
        response = await fetch(`${API_BASE_URL}/api/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            path: selectedServerFile,
          }),
        })
      }

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message ?? `API error: ${response.status}`)
      }

      setDemoMessage(`Inference job started with ${selectedModel === 'decision_tree' ? 'Decision Tree' : 'KNN'}.`)
      setPollingDetection(true)
    } catch (err) {
      setDemoMessage(err instanceof Error ? err.message : 'Failed to start prediction')
      setRunningDetection(false)
      setPollingDetection(false)
    }
  }

  const selectedModelTrained = trainedModels.find((m) => m.name === selectedModel)

  return (
    <div>
      <PageHeading
        title="Intrusion detection & inference"
        description="Train classifiers on training datasets or evaluate existing trained models on unseen test traffic without retraining."
      />

      {/* Workflow Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2">
        <button
          onClick={() => setActiveWorkflow('train')}
          className={`flex-1 rounded-xl px-5 py-3 text-sm font-semibold transition ${
            activeWorkflow === 'train'
              ? 'bg-cyan-500 text-slate-950 shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⚙ Mode 1: Train & Evaluate (80/20 Split)
        </button>
        <button
          onClick={() => setActiveWorkflow('predict')}
          className={`flex-1 rounded-xl px-5 py-3 text-sm font-semibold transition ${
            activeWorkflow === 'predict'
              ? 'bg-cyan-500 text-slate-950 shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ⚡ Mode 2: Predict Using Existing Model (Zero Retraining)
        </button>
      </div>

      {/* MODE 1: TRAIN & EVALUATE */}
      {activeWorkflow === 'train' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="font-semibold text-white">1. Select Model to Train</h3>
            <p className="mt-1 text-sm text-slate-400">
              The model will be trained on 80% of the currently loaded dataset and scored on the 20% test split.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedModel('decision_tree')}
                className={`rounded-xl px-5 py-3 text-sm font-medium transition ${
                  selectedModel === 'decision_tree'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'border border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                Decision Tree (CART)
              </button>

              <button
                onClick={() => setSelectedModel('knn')}
                className={`rounded-xl px-5 py-3 text-sm font-medium transition ${
                  selectedModel === 'knn'
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'border border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                KNN (K-Nearest Neighbors)
              </button>
            </div>

            {selectedModel === 'knn' && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  KNN Distance Metric
                </label>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setKnnDistance('euclidean')}
                    className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
                      knnDistance === 'euclidean'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'border border-slate-800 text-slate-400'
                    }`}
                  >
                    Euclidean (p = 2, A3 default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKnnDistance('manhattan')}
                    className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
                      knnDistance === 'manhattan'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'border border-slate-800 text-slate-400'
                    }`}
                  >
                    Manhattan (p = 1, A2 variant tests)
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-white">Train & Evaluate</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Currently loaded dataset in backend:{' '}
                  <span className="font-semibold text-cyan-300">
                    {loadedDatasetName || 'None (Load a dataset from the Dataset tab first)'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Splits 80/20, fits scaling & feature selection on 80%, trains model, and stores fitted model in memory.
                </p>
              </div>
              <button
                onClick={handleRunTrainAndEvaluate}
                disabled={runningDetection || !loadedDatasetName}
                className="rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningDetection ? 'Training...' : 'Train & Evaluate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: PREDICT USING EXISTING MODEL */}
      {activeWorkflow === 'predict' && (
        <div className="space-y-6">
          {/* Trained models status */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="font-semibold text-white">1. Select Retained Trained Model</h3>
            <p className="mt-1 text-sm text-slate-400">
              Inference uses the existing fitted model and the exact preprocessing statistics learned during training.
            </p>

            {trainedModels.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-300">
                  ⚠️ No models are currently trained in backend memory.
                </p>
                <p className="mt-1 text-xs text-amber-200/70">
                  Switch to Mode 1 (Train & Evaluate) to train on your training dataset (e.g.{' '}
                  <code className="text-white">A2_minus_DDoS.csv</code> or{' '}
                  <code className="text-white">sample_A3.csv</code>) first.
                </p>
                <button
                  onClick={() => setActiveWorkflow('train')}
                  className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Go to Train & Evaluate
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {trainedModels.map((tm) => (
                  <button
                    key={tm.name}
                    onClick={() => setSelectedModel(tm.name as 'decision_tree' | 'knn')}
                    className={`rounded-xl border p-4 text-left transition ${
                      selectedModel === tm.name
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">
                        {tm.name === 'decision_tree' ? 'Decision Tree' : 'KNN'}
                      </p>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        Trained
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Trained on: <span className="text-cyan-300">{tm.trainedOn}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Training Rows: {tm.trainRows?.toLocaleString()} · Features: {tm.features}
                    </p>
                    {tm.testAccuracy !== undefined && (
                      <p className="mt-1 text-xs text-slate-500">
                        Baseline Test Accuracy: {(tm.testAccuracy * 100).toFixed(2)}%
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Test dataset input */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="font-semibold text-white">2. Select Evaluation Dataset</h3>
            <p className="mt-1 text-sm text-slate-400">
              Evaluate unseen variant test files (e.g. <code className="text-cyan-300">held_DDoS.csv</code>) without retraining.
            </p>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setEvalSource('server')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  evalSource === 'server'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                Choose from Server Data Directory
              </button>
              <button
                type="button"
                onClick={() => setEvalSource('upload')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  evalSource === 'upload'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                Upload Custom CSV File
              </button>
            </div>

            {evalSource === 'server' ? (
              <div className="mt-4">
                <label className="text-xs text-slate-400">Available CSV files on server:</label>
                <select
                  value={selectedServerFile}
                  onChange={(e) => setSelectedServerFile(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {serverFiles.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-xs text-slate-400">Select test CSV file:</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadEvalFile(e.target.files[0])
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-950 hover:file:bg-cyan-400"
                />
                {uploadEvalFile && (
                  <p className="mt-2 text-xs text-cyan-300">
                    Selected: {uploadEvalFile.name} ({(uploadEvalFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-white">Execute Inference</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Model: <span className="font-semibold text-cyan-300">{selectedModel}</span>
                  {selectedModelTrained && (
                    <span> (trained on <code className="text-white">{selectedModelTrained.trainedOn}</code>)</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Strictly applies saved preprocessing statistics. No refitting. Unseen variants remain truly unseen.
                </p>
              </div>
              <button
                onClick={handleRunPredict}
                disabled={runningDetection || !selectedModelTrained}
                className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {runningDetection ? 'Evaluating...' : 'Evaluate Test Dataset (No Retraining)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress & Status Message */}
      <div className="mt-6">
        <p className="rounded-lg bg-slate-950/60 p-3 text-sm text-slate-300 border border-slate-800">
          {demoMessage}
        </p>
        {runningDetection && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs text-slate-400">
              <span>Job Progress</span>
              <span>{Math.round(detectionProgress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${detectionProgress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {detectionResults.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          {/* Metadata banner */}
          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400">
                  Evaluated Dataset
                </span>
                <p className="text-base font-semibold text-white">
                  {detectionMeta?.evaluatedOn ?? detectionMeta?.datasetName ?? 'Evaluation Dataset'}
                </p>
              </div>
              {detectionMeta?.trainedOn && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Model Trained On
                  </span>
                  <p className="text-base font-semibold text-cyan-300">
                    {detectionMeta.trainedOn}
                  </p>
                </div>
              )}
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400">
                  Execution Mode
                </span>
                <p className="mt-0.5">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                      detectionMeta?.mode === 'predict'
                        ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {detectionMeta?.mode === 'predict'
                      ? '⚡ Inference (Existing Model — Zero Retraining)'
                      : '⚙ Training Split (80/20 Test Split)'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <h3 className="font-semibold text-white">Classification Results</h3>
          <p className="mt-1 text-sm text-slate-400">
            {detectionResults.length} records evaluated by the C++ backend using{' '}
            <span className="text-cyan-300">
              {detectionMeta?.model === 'decision_tree' ? 'Decision Tree' : 'KNN'}
            </span>
            .
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Predicted Class</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Actual Class</th>
                  <th className="px-4 py-3">Correct</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {detectionResults.slice(0, 20).map((result) => (
                  <tr key={result.id}>
                    <td className="px-4 py-3 text-cyan-300">{result.id}</td>
                    <td className="px-4 py-3 text-white font-medium">{result.label}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {(result.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-slate-300">{result.actualLabel}</td>
                    <td className="px-4 py-3">
                      <span className={result.correct ? 'text-emerald-400' : 'text-red-400'}>
                        {result.correct ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Showing first {Math.min(20, detectionResults.length)} of {detectionResults.length} records. See Results & Evaluation page for full confusion matrix and metrics.
          </p>
        </div>
      )}
    </div>
  )
}

function ThreatsPage() {
  const [threats, setThreats] = useState<DetectionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [search, setSearch] = useState('')
  const [attackFilter, setAttackFilter] = useState('All')
  const [selectedThreat, setSelectedThreat] = useState<DetectionResult | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20 


const filteredThreats = threats.filter((threat) => {
  const matchesSearch =
    String(threat.id).toLowerCase().includes(search.toLowerCase()) ||
    threat.label.toLowerCase().includes(search.toLowerCase())

  const matchesAttack =
    attackFilter === 'All' || threat.label === attackFilter

  return matchesSearch && matchesAttack
})
  const totalPages = Math.max(
    1,
    Math.ceil(filteredThreats.length / pageSize)
  )

  const safePage = Math.min(currentPage, totalPages)

  const paginatedThreats = filteredThreats.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )


  useEffect(() => {
    const controller = new AbortController()

    async function loadThreats() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/detections`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error(`Detections API error: ${response.status}`)
        }

        const data = await response.json()
        setThreats(
          (data.items ?? []).filter(
            (item: DetectionResult) => item.isMalicious
          )
        )
      } catch (err) {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : 'Failed to load threats'
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadThreats()

    return () => controller.abort()
  }, [])

  return (

    <div className="space-y-6">
      <PageHeading
        title="Threat monitoring"
        description="Review and investigate network threats detected by the C++ backend."
      />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold text-white">
          Detected Threats
        </h3>
        
        <input
          type="text"
          value={search}
          onChange={(event) => {
          setSearch(event.target.value)
          setCurrentPage(1)
          setSelectedThreat(null)
          }}
          placeholder="Search by record ID or attack type..."
          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
        />
        
        <select
          value={attackFilter}
          onChange={(event) => {
          setAttackFilter(event.target.value)
          setCurrentPage(1)
          setSelectedThreat(null)
          }}
          className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
        >
          <option value="All">All attack types</option>
          {Array.from(new Set(threats.map((threat) => threat.label)))
            .sort()
            .map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
        </select>



        
          {loading && (
            <p className="mt-2 text-sm text-cyan-300">
              Loading real threats from backend...
            </p>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-400">
              {error}
            </p>
          )}

          {!loading && !error && (
            <p className="mt-2 text-sm text-slate-400">
              {threats.length} malicious records returned by the C++ backend.
            </p>
          )}
          
          {!loading && !error && filteredThreats.length === 0 && (
            <p className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 p-5 text-center text-sm text-slate-400">
              {threats.length === 0
                ? 'No predicted malicious records available. Run detection first.'
                : 'No threats match your search or selected attack type.'}
            </p>
          )}

          {!loading && !error && filteredThreats.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="border-b border-slate-700 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Record ID</th>
                    <th className="px-4 py-3">Attack Type</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Actual Class</th>
                    <th className="px-4 py-3">Correct</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {paginatedThreats.map((threat, index) => (
                    <tr key={threat.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">
                      {(safePage - 1) * pageSize + index + 1}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedThreat(threat)}
                        className="text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
                      >
                        {threat.id}
                      </button>
                    </td>

                      <td className="px-4 py-3 text-white">
                        {threat.label}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            threat.severity === 'High'
                              ? 'border-red-500/30 bg-red-500/10 text-red-400'
                              : threat.severity === 'Medium'
                              ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                              : threat.severity === 'Low'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-slate-700 bg-slate-800 text-slate-400'
                          }`}
                        >
                          {threat.severity ?? 'N/A'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-300">
                        {(threat.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {threat.actualLabel}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            threat.correct
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {threat.correct ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              
              <p className="mt-4 text-xs text-slate-500">
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredThreats.length)}
                {' '}of {filteredThreats.length} matching records
                {' '}({threats.length} total predicted malicious records).
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(safePage - 1)
                    setSelectedThreat(null)
                  }}
                  disabled={safePage === 1}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-slate-400">
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(safePage + 1)
                    setSelectedThreat(null)
                  }}
                  disabled={safePage === totalPages}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>

            </div>
          )}


      </div>
      
      {selectedThreat && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">
              Threat Details — Record {selectedThreat.id}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedThreat(null)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-slate-300">
              Predicted attack: <span className="text-white">{selectedThreat.label}</span>
            </p>

            <p className="text-sm text-slate-300">
              Severity:{' '}
              <span
                className={
                  selectedThreat.severity === 'High'
                    ? 'font-semibold text-red-400'
                    : selectedThreat.severity === 'Medium'
                    ? 'font-semibold text-yellow-400'
                    : selectedThreat.severity === 'Low'
                    ? 'font-semibold text-emerald-400'
                    : 'text-slate-400'
                }
              >
                {selectedThreat.severity ?? 'N/A'}
              </span>
            </p>
            <p className="text-sm text-slate-300">
              Confidence: <span className="text-white">
                {(selectedThreat.confidence * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-sm text-slate-300">
              Actual class: <span className="text-white">{selectedThreat.actualLabel}</span>
            </p>
            <p className="text-sm text-slate-300">
              Prediction correct: <span className={selectedThreat.correct ? 'text-emerald-400' : 'text-red-400'}>
                {selectedThreat.correct ? 'Yes' : 'No'}
              </span>
            </p>
            <p className="text-sm text-slate-300">
              Class index: <span className="text-white">{selectedThreat.classIndex}</span>
            </p>
            <p className="text-sm text-slate-300">
              Predicted malicious: <span className="text-white">
                {selectedThreat.isMalicious ? 'Yes' : 'No'}
              </span>
            </p>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            These details come from the C++ detection API. Source IP and timestamp are not provided by the current backend.
          </p>
        </div>
      )}

    </div>
  )
}



type EvaluationModel = 'decision_tree' | 'knn'

type EvaluationMetrics = {
  accuracy: number
  macroF1: number
  confusion: {
    labels: string[]
    matrix: number[][]
  }
  perClass: {
    name: string
    precision: number
    recall: number
    f1: number
    support: number
  }[]
}

type EvaluationReport = {
  metrics: EvaluationMetrics
  trainRows: number
  testRows: number
  timing: {
    trainMs: number
    predictMs: number
  }
  trainedOn?: string
  evaluatedOn?: string
  mode?: string
}

type EvaluationResponse = {
  datasetName: string
  trainedOn?: string
  evaluatedOn?: string
  mode?: string
  models: Partial<Record<EvaluationModel, EvaluationReport>>
}

const evaluationModels: EvaluationModel[] = ['decision_tree', 'knn']

function evaluationModelName(model: EvaluationModel) {
  return model === 'decision_tree' ? 'Decision Tree' : 'KNN'
}

function getMacroMetric(
  report: EvaluationReport | undefined,
  metric: 'precision' | 'recall'
) {
  if (!report || report.metrics.perClass.length === 0) return null

  const values = report.metrics.perClass.map((item) => item[metric])
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function ResultsPage() {
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadEvaluation() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/metrics`, {
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error(`Evaluation API error: ${response.status}`)
        }
        const data: EvaluationResponse = await response.json()
        if (!controller.signal.aborted) setEvaluation(data)
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load evaluation')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadEvaluation()
    return () => controller.abort()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Results & evaluation"
        description="Compare real Decision Tree and KNN results from the C++ backend."
      />

      {loading && <p className="text-cyan-300">Loading evaluation results...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && !evaluation && (
        <p className="text-slate-400">No evaluation results available.</p>
      )}

      {!loading && !error && evaluation && (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400">
                  Evaluated Dataset
                </span>
                <p className="text-base font-semibold text-white">
                  {evaluation.datasetName}
                </p>
              </div>
              {evaluation.trainedOn && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Model Trained On
                  </span>
                  <p className="text-base font-semibold text-cyan-300">
                    {evaluation.trainedOn}
                  </p>
                </div>
              )}
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400">
                  Execution Mode
                </span>
                <p className="mt-0.5">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                      evaluation.mode === 'predict'
                        ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {evaluation.mode === 'predict'
                      ? '⚡ Inference (Existing Model — Zero Retraining)'
                      : '⚙ Training Split (80/20 Test Split)'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-white">
            Side-by-Side Model Evaluation
          </h3>

          <div className="grid gap-4 lg:grid-cols-2">
            {evaluationModels.map((model) => {
              const modelReport = evaluation.models[model]

              if (!modelReport) {
                return (
                  <div
                    key={model}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                  >
                    <h3 className="font-semibold text-white">
                      {evaluationModelName(model)}
                    </h3>
                    <p className="mt-4 text-sm text-amber-300">
                      No results available. Run this model from Detection.
                    </p>
                  </div>
                )
              }

              const metrics = modelReport.metrics
              const scores = [
                { name: 'Accuracy', value: metrics.accuracy },
                { name: 'Precision', value: getMacroMetric(modelReport, 'precision') },
                { name: 'Recall', value: getMacroMetric(modelReport, 'recall') },
                { name: 'F1-score', value: metrics.macroF1 }
              ]

              return (
                <div
                  key={model}
                  className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-cyan-300">
                      {evaluationModelName(model)}
                    </h3>
                    {modelReport.mode && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          modelReport.mode === 'predict'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {modelReport.mode === 'predict' ? 'Inference Only' : '80/20 Test Split'}
                      </span>
                    )}
                  </div>
                  {modelReport.trainedOn && (
                    <p className="mt-1 text-xs text-slate-400">
                      Trained on: <span className="text-cyan-300">{modelReport.trainedOn}</span>
                      {modelReport.trainRows ? ` (${modelReport.trainRows.toLocaleString()} rows)` : ''}
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {scores.map((score) => (
                      <div
                        key={score.name}
                        className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                      >
                        <p className="text-xs text-slate-400">{score.name}</p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {score.value == null ? 'N/A' : `${(score.value * 100).toFixed(2)}%`}
                        </p>
                      </div>
                    ))}
                  </div>

                  <h4 className="mt-6 font-semibold text-white">Confusion Matrix</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Rows: Actual · Columns: Predicted
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-center text-xs">
                      <thead>
                        <tr>
                          <th className="p-2 text-slate-400">Actual / Pred.</th>
                          {metrics.confusion.labels.map((label, index) => (
                            <th key={index} className="p-2 text-slate-400">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.confusion.matrix.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <th className="p-2 text-slate-400">
                              {metrics.confusion.labels[rowIndex]}
                            </th>
                            {row.map((value, columnIndex) => (
                              <td
                                key={columnIndex}
                                className={`border border-slate-800 p-3 font-semibold ${
                                  rowIndex === columnIndex
                                    ? 'bg-emerald-500/10 text-emerald-300'
                                    : 'bg-red-500/10 text-red-300'
                                }`}
                              >
                                {value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-4 text-xs text-slate-400">
                    Training: {modelReport.timing.trainMs.toFixed(3)} ms
                    {' · '}
                    Prediction: {modelReport.timing.predictMs.toFixed(3)} ms
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}




type ComplexityModel = 'decision_tree' | 'knn'
type ComplexityMetric = 'predictMs' | 'trainMs'

type ComplexityRun = {
  fraction: number
  memoryBytes: number | null
  model: ComplexityModel
  predictMs: number
  predictMsPerRow: number
  testRows: number
  trainMs: number
  trainRows: number
}

type ComplexityResponse = {
  ready: boolean
  datasetName?: string
  finishedAt?: string
  notes?: string
  repeats?: number
  runs: ComplexityRun[]
  theory: {
    decision_tree: {
      train: string
      predict: string
      storage: string
    }
    knn: {
      train: string
      predict: string
      storage: string
    }
    variables: string
  }
}

function ComplexityPage() {
  const [selectedModel, setSelectedModel] =
    useState<ComplexityModel>('decision_tree')
  const [metric, setMetric] = useState<ComplexityMetric>('predictMs')
  const [data, setData] = useState<ComplexityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  async function loadComplexity() {
    const response = await fetch(`${API_BASE_URL}/api/complexity`)

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
        const response = await fetch(`${API_BASE_URL}/api/complexity`)

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
      const response = await fetch(
        `${API_BASE_URL}/api/complexity/run`,
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

function App() {
  const [activePage, setActivePage] = useState<Page>('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function renderPage() {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard />
      case 'Dataset':
        return <DatasetPage />
      case 'Threats':
        return <ThreatsPage />
      case 'Detection':
        return <DetectionPage />
      case 'Results & Evaluation':
        return <ResultsPage />
      case 'Complexity Analysis':
        return <ComplexityPage />
    }
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200">
      {sidebarOpen && (
        <button
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-[#0c1220] transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-bold text-slate-950">
            IN
          </div>
          <div>
            <h1 className="font-semibold tracking-wide text-white">INIDS</h1>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Network security
            </p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            Workspace
          </p>
          <nav className="mt-3 space-y-1">
            {pages.map((page) => (
              <button
                key={page.name}
                onClick={() => {
                  setActivePage(page.name)
                  setSidebarOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  activePage === page.name
                    ? 'bg-cyan-400/10 font-medium text-cyan-300'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">{page.icon}</span>
                <span>{page.name}</span>
                {activePage === page.name && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-slate-300">C++ Backend Integration</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Dataset, detection, and evaluation powered by the C++ API.
            </p>
          </div>
          <p className="px-2 pt-4 text-[10px] text-slate-600">INIDS · Network Security</p>
        </div>
      </aside>

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-[#090d16]/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 md:hidden"
            >
              ☰
            </button>
            <div>
              <p className="text-xs text-slate-500">INIDS / Workspace</p>
              <p className="mt-1 text-sm font-medium text-white">{activePage}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-300 sm:inline-flex">
              ● C++ Backend API
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-cyan-300">
              M3
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-8">
          {renderPage()}
          <footer className="mt-10 border-t border-slate-800 py-5 text-center text-xs text-slate-600">
            INIDS · Intelligent Network Intrusion Detection System 
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
