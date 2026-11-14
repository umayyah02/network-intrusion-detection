import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { PageHeading } from '../components/PageHeading'
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
