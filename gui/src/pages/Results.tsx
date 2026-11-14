import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { PageHeading } from '../components/PageHeading'
import type { EvaluationModel, EvaluationReport, EvaluationResponse } from '../types/api'

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

export function ResultsPage() {
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadEvaluation() {
      try {
        const response = await apiFetch(endpoints.metrics, {
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
