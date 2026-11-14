import { useEffect, useState } from 'react'
import { throwApiError } from '../api/ApiError'
import { apiFetch } from '../api/client'
import { endpoints } from '../api/endpoints'
import { EmptyState, ErrorState } from '../components/charts/PanelStates'
import { PageHeading } from '../components/PageHeading'
import { GlassPanel, Pill, Skeleton } from '../components/ui'
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

function percent(value: number | null | undefined) {
  return value == null ? 'N/A' : `${(value * 100).toFixed(2)}%`
}

/** Heat color: emerald on the diagonal (correct), rose off it (errors). Strength = share of the actual row. */
function cellColor(value: number, rowTotal: number, correct: boolean) {
  const share = rowTotal > 0 ? value / rowTotal : 0
  const alpha = value === 0 ? 0.04 : 0.14 + 0.5 * share
  return correct ? `rgb(52 211 153 / ${alpha})` : `rgb(251 113 133 / ${alpha})`
}

function ModeBadge({ mode, short = false }: { mode?: string; short?: boolean }) {
  const predict = mode === 'predict'
  const label = short
    ? predict
      ? 'Inference Only'
      : '80/20 Test Split'
    : predict
      ? '⚡ Inference (Existing Model — Zero Retraining)'
      : '⚙ Training Split (80/20 Test Split)'
  return <Pill tone={predict ? 'medium' : 'success'}>{label}</Pill>
}

function ConfusionMatrix({ report }: { report: EvaluationReport }) {
  const { labels, matrix } = report.metrics.confusion

  return (
    <>
      <h4 className="mt-6 font-semibold">Confusion Matrix</h4>
      <p className="mt-1 text-xs text-muted">
        Rows: Actual · Columns: Predicted · Green diagonal = correct, red = misclassified.
        Shading shows the share of each actual class.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-center text-xs">
          <thead>
            <tr>
              <th scope="col" className="p-2 text-muted">Actual / Pred.</th>
              {labels.map((label, index) => (
                <th key={index} scope="col" className="p-2 text-muted">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => {
              const rowTotal = row.reduce((sum, value) => sum + value, 0)
              return (
                <tr key={rowIndex}>
                  <th scope="row" className="p-2 text-muted">{labels[rowIndex]}</th>
                  {row.map((value, columnIndex) => (
                    <td
                      key={columnIndex}
                      title={`Actual ${labels[rowIndex]}, predicted ${labels[columnIndex]}: ${value}`}
                      style={{
                        backgroundColor: cellColor(value, rowTotal, rowIndex === columnIndex),
                      }}
                      className="border border-line p-3 font-mono font-semibold text-fg"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ModelCard({ model, report }: { model: EvaluationModel; report?: EvaluationReport }) {
  if (!report) {
    return (
      <GlassPanel>
        <h3 className="font-semibold">{evaluationModelName(model)}</h3>
        <p className="mt-4 text-sm text-sev-medium-fg">
          No results available. Run this model from Detection.
        </p>
        <a
          href="#detection"
          className="mt-3 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          Go to Detection
        </a>
      </GlassPanel>
    )
  }

  const scores = [
    { name: 'Accuracy', value: report.metrics.accuracy },
    { name: 'Precision', value: getMacroMetric(report, 'precision') },
    { name: 'Recall', value: getMacroMetric(report, 'recall') },
    { name: 'F1-score', value: report.metrics.macroF1 },
  ]

  return (
    <GlassPanel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-accent">{evaluationModelName(model)}</h3>
        {report.mode && <ModeBadge mode={report.mode} short />}
      </div>
      {report.trainedOn && (
        <p className="mt-1 text-xs text-muted">
          Trained on: <span className="text-accent">{report.trainedOn}</span>
          {report.trainRows ? ` (${report.trainRows.toLocaleString()} rows)` : ''}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        {scores.map((score) => (
          <div key={score.name} className="rounded-xl border border-line bg-void/40 p-4">
            <p className="text-xs text-muted">{score.name}</p>
            <p className="mt-2 font-mono text-xl font-semibold">{percent(score.value)}</p>
          </div>
        ))}
      </div>

      <ConfusionMatrix report={report} />

      <p className="mt-4 font-mono text-xs text-muted">
        Training: {report.timing.trainMs.toFixed(3)} ms
        {' · '}
        Prediction: {report.timing.predictMs.toFixed(3)} ms
      </p>
    </GlassPanel>
  )
}

function ResultsSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
      <span className="sr-only">Loading evaluation results...</span>
      {[0, 1].map((item) => (
        <GlassPanel key={item} className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </GlassPanel>
      ))}
    </div>
  )
}

export function ResultsPage() {
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadEvaluation() {
      try {
        setLoading(true)
        setError(null)
        const response = await apiFetch(endpoints.metrics, {
          signal: controller.signal,
        })
        if (!response.ok) {
          await throwApiError(response, 'Evaluation')
        }
        const data: EvaluationResponse = await response.json()
        if (!controller.signal.aborted) setEvaluation(data)
      } catch (err) {
        if (!controller.signal.aborted) setError(err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadEvaluation()
    return () => controller.abort()
  }, [reloadKey])

  return (
    <div className="space-y-6">
      <PageHeading
        title="Results & evaluation"
        description="Compare real Decision Tree and KNN results from the C++ backend."
      />

      {loading && <ResultsSkeleton />}

      {!loading && error != null && (
        <ErrorState
          error={error}
          what="evaluation results"
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      )}

      {!loading && error == null && !evaluation && (
        <EmptyState
          title="No evaluation results available"
          body="Run a model from the Detection page to see accuracy, precision, recall and confusion matrices here."
        />
      )}

      {!loading && error == null && evaluation && (
        <>
          <GlassPanel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">
                  Evaluated Dataset
                </span>
                <p className="text-base font-semibold">{evaluation.datasetName}</p>
              </div>
              {evaluation.trainedOn && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted">
                    Model Trained On
                  </span>
                  <p className="text-base font-semibold text-accent">{evaluation.trainedOn}</p>
                </div>
              )}
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">
                  Execution Mode
                </span>
                <p className="mt-0.5">
                  <ModeBadge mode={evaluation.mode} />
                </p>
              </div>
            </div>
          </GlassPanel>

          <h3 className="text-lg font-semibold">Side-by-Side Model Evaluation</h3>

          <div className="grid gap-4 lg:grid-cols-2">
            {evaluationModels.map((model) => (
              <ModelCard key={model} model={model} report={evaluation.models[model]} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
