import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { Cog, Zap, TriangleAlert } from 'lucide-react'
import { PageHeading } from '../components/PageHeading'
import { Button, GlassPanel, Pill, cx } from '../components/ui'
import type { DetectionResult, RetainedModelInfo } from '../types/api'

export function DetectionPage() {
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
      const res = await apiFetch(endpoints.models)
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
      const res = await apiFetch(endpoints.datasetFiles)
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
      const res = await apiFetch(endpoints.datasets)
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
      const response = await apiFetch(endpoints.detections)

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
      const response = await apiFetch(endpoints.detectStatus)

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

      const response = await apiFetch(endpoints.detect, {
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

        response = await apiFetch(endpoints.predict, {
          method: 'POST',
          body: formData,
        })
      } else {
        if (!selectedServerFile) {
          throw new Error('Please select an evaluation dataset from the list.')
        }
        response = await apiFetch(endpoints.predict, {
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
  const modelLabel = (m: string) => (m === 'decision_tree' ? 'Decision Tree' : 'KNN')

  const choice = (active: boolean) =>
    cx(
      'rounded-xl border px-5 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-accent',
      active
        ? 'border-accent bg-accent-soft text-accent shadow-glow'
        : 'border-line text-muted hover:border-line-strong hover:text-fg',
    )

  return (
    <div className="space-y-6">
      <PageHeading
        title="Intrusion detection & inference"
        description="Train classifiers on training datasets or evaluate existing trained models on unseen test traffic without retraining."
      />

      {/* Workflow tabs */}
      <GlassPanel flush className="flex flex-wrap gap-2 p-2" role="tablist" aria-label="Detection workflow">
        {(
          [
            ['train', Cog, 'Mode 1: Train & Evaluate (80/20 Split)'],
            ['predict', Zap, 'Mode 2: Predict Using Existing Model (Zero Retraining)'],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeWorkflow === key}
            onClick={() => setActiveWorkflow(key)}
            className={cx(
              'flex min-w-60 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition',
              'focus-visible:outline-2 focus-visible:outline-accent',
              activeWorkflow === key ? 'bg-accent text-accent-fg shadow-glow' : 'text-muted hover:text-fg',
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </GlassPanel>

      {/* MODE 1: TRAIN & EVALUATE */}
      {activeWorkflow === 'train' && (
        <div className="space-y-6">
          <GlassPanel>
            <h3 className="font-semibold">1. Select model to train</h3>
            <p className="mt-1 text-sm text-muted">
              The model will be trained on 80% of the currently loaded dataset and scored on the 20% test split.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                aria-pressed={selectedModel === 'decision_tree'}
                onClick={() => setSelectedModel('decision_tree')}
                className={choice(selectedModel === 'decision_tree')}
              >
                Decision Tree (CART)
              </button>
              <button
                aria-pressed={selectedModel === 'knn'}
                onClick={() => setSelectedModel('knn')}
                className={choice(selectedModel === 'knn')}
              >
                KNN (K-Nearest Neighbors)
              </button>
            </div>

            {selectedModel === 'knn' && (
              <div className="mt-4 rounded-xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">KNN distance metric</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    aria-pressed={knnDistance === 'euclidean'}
                    onClick={() => setKnnDistance('euclidean')}
                    className={choice(knnDistance === 'euclidean')}
                  >
                    Euclidean (p = 2, A3 default)
                  </button>
                  <button
                    type="button"
                    aria-pressed={knnDistance === 'manhattan'}
                    onClick={() => setKnnDistance('manhattan')}
                    className={choice(knnDistance === 'manhattan')}
                  >
                    Manhattan (p = 1, A2 variant tests)
                  </button>
                </div>
              </div>
            )}
          </GlassPanel>

          <GlassPanel glow="accent">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold">Train & Evaluate</h3>
                <p className="mt-1 text-sm text-muted">
                  Currently loaded dataset in backend:{' '}
                  {loadedDatasetName ? (
                    <span className="font-mono font-semibold text-accent">{loadedDatasetName}</span>
                  ) : (
                    <span className="text-sev-medium-fg">
                      None.{' '}
                      <a href="#dataset" className="underline underline-offset-4">
                        Load a dataset first
                      </a>
                      .
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Splits 80/20, fits scaling & feature selection on 80%, trains model, and stores fitted model in memory.
                </p>
              </div>
              <Button
                onClick={handleRunTrainAndEvaluate}
                disabled={!loadedDatasetName}
                loading={runningDetection}
              >
                {runningDetection ? 'Training...' : 'Train & Evaluate'}
              </Button>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* MODE 2: PREDICT USING EXISTING MODEL */}
      {activeWorkflow === 'predict' && (
        <div className="space-y-6">
          <GlassPanel>
            <h3 className="font-semibold">1. Select retained trained model</h3>
            <p className="mt-1 text-sm text-muted">
              Inference uses the existing fitted model and the exact preprocessing statistics learned during training.
            </p>

            {trainedModels.length === 0 ? (
              <div className="mt-4 rounded-xl border border-sev-medium/40 bg-sev-medium-soft p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-sev-medium-fg">
                  <TriangleAlert size={16} aria-hidden="true" />
                  No models are currently trained in backend memory.
                </p>
                <p className="mt-1 text-xs text-muted">
                  Switch to Mode 1 (Train & Evaluate) to train on your training dataset (e.g.{' '}
                  <code className="font-mono text-fg">A2_minus_DDoS.csv</code> or{' '}
                  <code className="font-mono text-fg">sample_A3.csv</code>) first.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setActiveWorkflow('train')}>
                  Go to Train & Evaluate
                </Button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {trainedModels.map((tm) => (
                  <button
                    key={tm.name}
                    aria-pressed={selectedModel === tm.name}
                    onClick={() => setSelectedModel(tm.name as 'decision_tree' | 'knn')}
                    className={cx(
                      'rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-accent',
                      selectedModel === tm.name
                        ? 'border-accent bg-accent-soft shadow-glow'
                        : 'border-line hover:border-line-strong',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{modelLabel(tm.name)}</p>
                      <Pill tone="success">Trained</Pill>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Trained on: <span className="font-mono text-accent">{tm.trainedOn}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Training rows: {tm.trainRows?.toLocaleString()} · Features: {tm.features}
                    </p>
                    {tm.testAccuracy !== undefined && (
                      <p className="mt-1 text-xs text-muted">
                        Baseline test accuracy: {(tm.testAccuracy * 100).toFixed(2)}%
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel>
            <h3 className="font-semibold">2. Select evaluation dataset</h3>
            <p className="mt-1 text-sm text-muted">
              Evaluate unseen variant test files (e.g. <code className="font-mono text-accent">held_DDoS.csv</code>) without
              retraining.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                aria-pressed={evalSource === 'server'}
                onClick={() => setEvalSource('server')}
                className={choice(evalSource === 'server')}
              >
                Choose from server data directory
              </button>
              <button
                type="button"
                aria-pressed={evalSource === 'upload'}
                onClick={() => setEvalSource('upload')}
                className={choice(evalSource === 'upload')}
              >
                Upload custom CSV file
              </button>
            </div>

            {evalSource === 'server' ? (
              <div className="mt-4">
                <label htmlFor="server-file" className="text-xs text-muted">
                  Available CSV files on server:
                </label>
                <select
                  id="server-file"
                  value={selectedServerFile}
                  onChange={(e) => setSelectedServerFile(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-void/60 px-4 py-3 font-mono text-sm text-fg outline-none focus:border-accent focus-visible:outline-2 focus-visible:outline-accent"
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
                <label htmlFor="eval-upload" className="text-xs text-muted">
                  Select test CSV file:
                </label>
                <input
                  id="eval-upload"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadEvalFile(e.target.files[0])
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-line bg-void/60 p-3 text-sm text-fg file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-accent-fg hover:file:brightness-110"
                />
                {uploadEvalFile && (
                  <p className="mt-2 text-xs text-accent">
                    Selected: {uploadEvalFile.name} ({(uploadEvalFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            )}
          </GlassPanel>

          <GlassPanel glow="warn">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold">Execute inference</h3>
                <p className="mt-1 text-sm text-muted">
                  Model: <span className="font-semibold text-accent">{selectedModel}</span>
                  {selectedModelTrained && (
                    <span>
                      {' '}
                      (trained on <code className="font-mono text-fg">{selectedModelTrained.trainedOn}</code>)
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Strictly applies saved preprocessing statistics. No refitting. Unseen variants remain truly unseen.
                </p>
              </div>
              <Button
                onClick={handleRunPredict}
                disabled={!selectedModelTrained}
                loading={runningDetection}
                className="!bg-sev-medium"
              >
                {runningDetection ? 'Evaluating...' : 'Evaluate Test Dataset (No Retraining)'}
              </Button>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Progress & status message */}
      <div>
        <p role="status" className="glass px-4 py-3 text-sm text-muted">
          {demoMessage}
        </p>
        {runningDetection && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs text-muted">
              <span>Job progress</span>
              <span className="font-mono">{Math.round(detectionProgress * 100)}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Job progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(detectionProgress * 100)}
              className="h-2 overflow-hidden rounded-full bg-accent-soft"
            >
              <div
                className="h-full rounded-full bg-accent shadow-glow transition-all"
                style={{ width: `${detectionProgress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {detectionResults.length > 0 && (
        <GlassPanel>
          <div className="mb-5 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">Evaluated dataset</span>
                <p className="font-mono text-base font-semibold">
                  {detectionMeta?.evaluatedOn ?? detectionMeta?.datasetName ?? 'Evaluation Dataset'}
                </p>
              </div>
              {detectionMeta?.trainedOn && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted">Model trained on</span>
                  <p className="font-mono text-base font-semibold text-accent">{detectionMeta.trainedOn}</p>
                </div>
              )}
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">Execution mode</span>
                <p className="mt-0.5">
                  <Pill tone={detectionMeta?.mode === 'predict' ? 'medium' : 'success'}>
                    {detectionMeta?.mode === 'predict'
                      ? 'Inference (existing model, zero retraining)'
                      : 'Training split (80/20 test split)'}
                  </Pill>
                </p>
              </div>
            </div>
          </div>

          <h3 className="font-semibold">Classification results</h3>
          <p className="mt-1 text-sm text-muted">
            {detectionResults.length} records evaluated by the C++ backend using{' '}
            <span className="text-accent">{detectionMeta?.model === 'decision_tree' ? 'Decision Tree' : 'KNN'}</span>.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">ID</th>
                  <th className="py-2 pr-4 font-medium">Predicted class</th>
                  <th className="py-2 pr-4 font-medium">Confidence</th>
                  <th className="py-2 pr-4 font-medium">Actual class</th>
                  <th className="py-2 font-medium">Correct</th>
                </tr>
              </thead>
              <tbody>
                {detectionResults.slice(0, 20).map((result) => (
                  <tr key={result.id} className="border-t border-line hover:bg-accent-soft">
                    <td className="py-2.5 pr-4 font-mono text-accent">#{result.id}</td>
                    <td className="py-2.5 pr-4 font-medium">{result.label}</td>
                    <td className="py-2.5 pr-4 font-mono">{(result.confidence * 100).toFixed(1)}%</td>
                    <td className="py-2.5 pr-4">{result.actualLabel}</td>
                    <td className="py-2.5">
                      <Pill tone={result.correct ? 'success' : 'danger'}>{result.correct ? 'Yes' : 'No'}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Showing first {Math.min(20, detectionResults.length)} of {detectionResults.length} records. See Results & Evaluation
            page for full confusion matrix and metrics.
          </p>
        </GlassPanel>
      )}
    </div>
  )
}
