
import { useState } from 'react'

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts'


type Page =
  | 'Dashboard'
  | 'Dataset'
  | 'Detection'
  | 'Results & Evaluation'
  | 'Complexity Analysis'

const pages: { name: Page; icon: string }[] = [
  { name: 'Dashboard', icon: '▦' },
  { name: 'Dataset', icon: '▤' },
  { name: 'Detection', icon: '⌁' },
  { name: 'Results & Evaluation', icon: '◫' },
  { name: 'Complexity Analysis', icon: '⌘' },
]

const detections = [
  { id: 'EVT-001', source: '192.168.1.14', type: 'Port Scanning', severity: 'High', time: '10:42:18' },
  { id: 'EVT-002', source: '10.0.0.27', type: 'Brute Force', severity: 'Critical', time: '10:38:52' },
  { id: 'EVT-003', source: '172.16.0.8', type: 'Normal Traffic', severity: 'Low', time: '10:31:06' },
  { id: 'EVT-004', source: '192.168.1.92', type: 'DDoS Pattern', severity: 'High', time: '10:24:41' },
  { id: 'EVT-005', source: '10.0.0.41', type: 'Normal Traffic', severity: 'Low', time: '10:17:33' },
]

// Illustrative traffic series for the frontend demo; not real detections.

const traffic = Array.from({ length: 501 }, (_, i) => {
  const x = i * 20

  const normal =
    50 +
    150 * (1 - Math.exp(-x / 3000)) +
    12 * Math.sin(i * 0.12) +
    5 * Math.sin(i * 0.47) +
    3 * Math.sin(i * 1.31)

  const malicious =
    130 +
    230 * (1 - Math.exp(-x / 4500)) +
    38 * Math.sin(i * 0.045) +
    15 * Math.sin(i * 0.19) +
    9 * Math.sin(i * 0.81)

  return {
    interval: x,
    normal: Math.round(normal),
    malicious: Math.round(malicious),
  }
})


const graphTraffic = traffic.filter(
  (_, index) => index % 3 === 0 || index === traffic.length - 1
)

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

function Severity({ value }: { value: string }) {
  const styles: Record<string, string> = {
    Critical: 'border-red-500/30 bg-red-500/10 text-red-300',
    High: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    Medium: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    Low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  }

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[value] ?? styles.Low}`}>
      {value}
    </span>
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
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Security overview</h2>
          <p className="mt-2 text-sm text-slate-400">
            Monitor network activity and review potential threats.
          </p>
        </div>
        <span className="w-fit rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300">
          DEMO DATA
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Packets Analyzed"
          value="24,891"
          note="Illustrative sample count"
          icon="⇄"
          color="bg-cyan-500/10 text-cyan-300"
        />
        <MetricCard
          title="Threats Detected"
          value="128"
          note="Illustrative sample count"
          icon="⚠"
          color="bg-red-500/10 text-red-300"
        />
        <MetricCard
          title="Normal Traffic"
          value="94.2%"
          note="Placeholder — not measured"
          icon="◉"
          color="bg-emerald-500/10 text-emerald-300"
        />
        <MetricCard
          title="System Status"
          value="Demo"
          note="Backend integration pending"
          icon="⌁"
          color="bg-violet-500/10 text-violet-300"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Threats detected over time</h3>
              <p className="mt-1 text-xs text-slate-500">Illustrative traffic trends — not live data</p>
            </div>
            <span className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
              10k demo records
            </span>
          </div>

          
<div className="mt-6 h-72 w-full min-w-0">
  <ResponsiveContainer width="100%" height="100%">
    <ComposedChart
      data={graphTraffic}
      margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
    >
      <defs>
        <linearGradient id="normalFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d6a0" stopOpacity={0.20} />
          <stop offset="100%" stopColor="#00d6a0" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="maliciousFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff416c" stopOpacity={0.13} />
          <stop offset="100%" stopColor="#ff416c" stopOpacity={0} />
        </linearGradient>
      </defs>

      <CartesianGrid
        stroke="#172b43"
        strokeOpacity={0.65}
        strokeDasharray="3 3"
      />

      <XAxis
        dataKey="interval"
        type="number"
        domain={[0, 10000]}
        ticks={[0, 2000, 4000, 6000, 8000, 10000]}
        tickFormatter={(value) => value === 0 ? '0' : `${value / 1000}k`}
        stroke="#68809b"
        tick={{ fontSize: 11 }}
      />

      <YAxis
        domain={[0, 500]}
        ticks={[0, 100, 200, 300, 400, 500]}
        stroke="#68809b"
        tick={{ fontSize: 11 }}
      />

      <Tooltip
        contentStyle={{
          backgroundColor: '#0c192b',
          border: '1px solid #28405a',
          borderRadius: 8,
          color: '#ffffff',
        }}
      />

      <Legend
        verticalAlign="top"
        align="right"
        wrapperStyle={{ fontSize: 11 }}
      />

      <Area
        type="linear"
        dataKey="normal"
        fill="url(#normalFill)"
        stroke="none"
        legendType="none"
        tooltipType="none"
        isAnimationActive={false}
      />

      <Area
        type="linear"
        dataKey="malicious"
        fill="url(#maliciousFill)"
        stroke="none"
        legendType="none"
        tooltipType="none"
        isAnimationActive={false}
      />

      <Line
        type="linear"
        dataKey="malicious"
        name="Malicious"
        stroke="#ff416c"
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />

      <Line
        type="linear"
        dataKey="normal"
        name="Normal"
        stroke="#00d6a0"
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </ComposedChart>
  </ResponsiveContainer>
</div>

          <p className="mt-4 text-xs text-slate-500">
            Sample visualization only. Real traffic data will come from the backend.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="font-semibold text-white">Traffic classification</h3>
          <p className="mt-1 text-xs text-slate-500">Illustrative distribution</p>

          <div className="mx-auto my-7 flex h-36 w-36 items-center justify-center rounded-full"
            style={{ background: 'conic-gradient(#22d3ee 0% 65%, #a78bfa 65% 85%, #fb7185 85% 100%)' }}>
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-slate-900">
              <span className="text-xl font-semibold text-white">Demo</span>
              <span className="text-xs text-slate-500">Traffic</span>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Normal', color: 'bg-cyan-400', value: '65%' },
              { label: 'Suspicious', color: 'bg-violet-400', value: '20%' },
              { label: 'Malicious', color: 'bg-rose-400', value: '15%' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  {item.label}
                </div>
                <span className="text-slate-400">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Percentages are illustrative, not experimental results.</p>
        </div>
      </div>

      <DetectionTable rows={detections.slice(0, 4)} />
    </div>
  )
}

function DetectionTable({
  rows,
}: {
  rows: typeof detections
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
        <div>
          <h3 className="font-semibold text-white">Recent network events</h3>
          <p className="mt-1 text-xs text-slate-500">Sample records for interface development</p>
        </div>
        <span className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
          {rows.length} records
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4 font-medium">Event ID</th>
              <th className="px-5 py-4 font-medium">Source IP</th>
              <th className="px-5 py-4 font-medium">Classification</th>
              <th className="px-5 py-4 font-medium">Severity</th>
              <th className="px-5 py-4 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-800/40">
                <td className="px-5 py-4 font-mono text-xs text-cyan-300">{row.id}</td>
                <td className="px-5 py-4 text-slate-300">{row.source}</td>
                <td className="px-5 py-4 text-slate-300">{row.type}</td>
                <td className="px-5 py-4"><Severity value={row.severity} /></td>
                <td className="px-5 py-4 text-slate-400">{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DatasetPage() {
  const [search, setSearch] = useState('')
  const [dataset, setDataset] = useState('NSL-KDD')

  const datasets = [
    { name: 'NSL-KDD', records: '125,973', features: '41', status: 'Sample' },
    { name: 'UNSW-NB15', records: 'Not loaded', features: '49', status: 'Planned' },
    { name: 'Custom dataset', records: 'Not loaded', features: '—', status: 'Planned' },
  ]

  const filtered = datasets.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <PageHeading
        title="Dataset management"
        description="Review available datasets and prepare network traffic data for analysis."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard title="Available datasets" value="1 sample" note="Demo interface status" icon="▤" color="bg-cyan-500/10 text-cyan-300" />
        <MetricCard title="Feature selection" value="Planned" note="Connect to backend preprocessing" icon="⚙" color="bg-violet-500/10 text-violet-300" />
        <MetricCard title="Data validation" value="Pending" note="Requires dataset processing API" icon="✓" color="bg-amber-500/10 text-amber-300" />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search datasets..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500 sm:max-w-sm"
          />
          <span className="text-xs text-slate-500">Dataset loading will be connected to the API.</span>
        </div>

        <div className="mt-5 space-y-3">
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
                  Records: {item.records} · Features: {item.features}
                </p>
              </div>
              <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                {item.status}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No matching datasets found.</p>
          )}
        </div>

        <p className="mt-5 text-xs text-slate-500">
          Selected dataset: <span className="text-cyan-300">{dataset}</span>. Dataset selection currently affects the interface only.
        </p>
      </div>
    </div>
  )
}

function DetectionPage() {
  const [filter, setFilter] = useState('All')
  const [demoMessage, setDemoMessage] = useState('No detection job has been run.')

  const rows = detections.filter((item) => {
    if (filter === 'All') return true
    if (filter === 'Threats') return item.severity === 'High' || item.severity === 'Critical'
    return item.type === 'Normal Traffic'
  })

  return (
    <div>
      <PageHeading
        title="Intrusion detection"
        description="Review traffic classifications and prepare a detection run."
      />

      <div className="mb-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-white">Detection engine</h3>
            <p className="mt-2 text-sm text-slate-400">
              Backend integration is pending. The button below runs a UI demonstration only.
            </p>
          </div>
          <button
            onClick={() => setDemoMessage('Demo action completed. No real network traffic was analyzed.')}
            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Run demo action
          </button>
        </div>
        <p className="mt-4 rounded-lg bg-slate-950/60 p-3 text-sm text-violet-200">{demoMessage}</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['All', 'Threats', 'Normal'].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              filter === item
                ? 'bg-cyan-500 text-slate-950'
                : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <DetectionTable rows={rows} />
    </div>
  )
}

type DemoModel = 'Decision Tree' | 'KNN'

const evaluationLabels = ['BENIGN', 'DoS', 'PortScan', 'BruteForce']

// Illustrative UI fixtures only. Replace with backend evaluation responses during integration.
const demoConfusionMatrices: Record<DemoModel, number[][]> = {
  'Decision Tree': [
    [76, 2, 1, 1],
    [3, 35, 2, 0],
    [1, 2, 36, 1],
    [1, 1, 2, 36],
  ],
  KNN: [
    [73, 4, 2, 1],
    [4, 33, 2, 1],
    [2, 3, 33, 2],
    [2, 2, 3, 33],
  ],
}

function getDemoMetrics(matrix: number[][]) {
  const count = matrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0)
  const correct = matrix.reduce((sum, row, i) => sum + row[i], 0)
  let precision = 0
  let recall = 0
  let f1 = 0
  for (let i = 0; i < matrix.length; i++) {
    const tp = matrix[i][i]
    const predicted = matrix.reduce((sum, row) => sum + row[i], 0)
    const actual = matrix[i].reduce((sum, value) => sum + value, 0)
    const p = predicted ? tp / predicted : 0
    const r = actual ? tp / actual : 0
    precision += p
    recall += r
    f1 += p + r ? (2 * p * r) / (p + r) : 0
  }
  const n = matrix.length
  return {
    accuracy: count ? (correct / count) * 100 : 0,
    precision: (precision / n) * 100,
    recall: (recall / n) * 100,
    f1: (f1 / n) * 100,
    count,
  }
}

function ResultsPage() {
  const [selectedModel, setSelectedModel] = useState<DemoModel>('Decision Tree')
  const matrix = demoConfusionMatrices[selectedModel]
  const metrics = getDemoMetrics(matrix)
  const otherModel: DemoModel = selectedModel === 'Decision Tree' ? 'KNN' : 'Decision Tree'
  // const otherMetrics = getDemoMetrics(demoConfusionMatrices[otherModel])
  const metricCards = [
    { title: 'Accuracy', value: metrics.accuracy, description: 'Correct classifications' },
    { title: 'Precision', value: metrics.precision, description: 'Macro-average across 4 classes' },
    { title: 'Recall', value: metrics.recall, description: 'Macro-average across 4 classes' },
    { title: 'F1-score', value: metrics.f1, description: 'Macro-average across 4 classes' },
  ]
  const comparisons = [
    { name: 'Accuracy', first: getDemoMetrics(demoConfusionMatrices['Decision Tree']).accuracy, second: getDemoMetrics(demoConfusionMatrices.KNN).accuracy },
    { name: 'Precision', first: getDemoMetrics(demoConfusionMatrices['Decision Tree']).precision, second: getDemoMetrics(demoConfusionMatrices.KNN).precision },
    { name: 'Recall', first: getDemoMetrics(demoConfusionMatrices['Decision Tree']).recall, second: getDemoMetrics(demoConfusionMatrices.KNN).recall },
    { name: 'F1-score', first: getDemoMetrics(demoConfusionMatrices['Decision Tree']).f1, second: getDemoMetrics(demoConfusionMatrices.KNN).f1 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeading
          title="Results & evaluation"
          description="Explore the evaluation dashboard layout for Decision Tree and KNN."
        />
        <span className="w-fit rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300">
          DEMO RESULTS
        </span>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
        All values below are illustrative UI fixtures, NOT trained-model measurements. The backend has not supplied evaluation results yet.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div>
          <h3 className="font-semibold text-white">Selected model</h3>
          <p className="mt-1 text-xs text-slate-400">Switch models to preview their demo reports.</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Select evaluation model">
          {(['Decision Tree', 'KNN'] as DemoModel[]).map((model) => (
            <button
              key={model}
              type="button"
              aria-pressed={selectedModel === model}
              onClick={() => setSelectedModel(model)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedModel === model
                  ? 'bg-cyan-400 text-slate-950'
                  : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
              }`}
            >
              {model}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">{item.title}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{item.value.toFixed(1)}%</p>
            <p className="mt-3 text-xs text-slate-500">{item.description} · Demo</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="font-semibold text-white">Confusion matrix</h3>
          <p className="mt-1 text-xs text-slate-500">{selectedModel} · Rows = actual class, columns = predicted class · Demo</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[430px] border-separate border-spacing-1 text-center text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left font-medium text-slate-500">Actual / Pred.</th>
                  {evaluationLabels.map((label) => <th key={label} className="p-2 font-medium text-slate-400">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={evaluationLabels[i]}>
                    <th className="p-2 text-left font-medium text-slate-400">{evaluationLabels[i]}</th>
                    {row.map((value, j) => (
                      <td
                        key={j}
                        className={`rounded-lg border p-3 font-semibold ${i === j
                          ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-200'
                          : 'border-rose-500/10 bg-rose-500/10 text-rose-200'}`}
                        title={`${evaluationLabels[i]} predicted as ${evaluationLabels[j]}: ${value} (demo)`}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">Green diagonal = correct predictions; red cells = misclassifications. {metrics.count} illustrative test records.</p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="font-semibold text-white">Model comparison</h3>
          <p className="mt-1 text-xs text-slate-500">Decision Tree vs KNN · Illustrative metrics, not benchmarks</p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
            <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-cyan-400" />Decision Tree</span>
            <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-violet-400" />KNN</span>
          </div>
          <div className="mt-6 space-y-5">
            {comparisons.map((item) => (
              <div key={item.name}>
                <p className="mb-2 text-sm text-slate-300">{item.name}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${item.first}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums text-slate-400">{item.first.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-violet-400" style={{ width: `${item.second}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums text-slate-400">{item.second.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-500">{selectedModel} is selected. {otherModel} is shown for visual comparison only. Real evaluation will use the same held-out test set for both models.</p>
        </section>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="font-semibold text-white">Integration status</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Evaluation API not connected. When the backend returns per-model metrics and a 4×4 confusion matrix, these demo fixtures can be replaced without changing the page layout.
        </p>
      </div>
    </div>
  )
}

type ComplexityModel = 'Decision Tree' | 'KNN'
type ComplexityMetric = 'runtime' | 'memory'

// Synthetic curves for UI development only. These are not measured benchmarks.
const complexityDemo = [250, 500, 1000, 2000, 4000, 8000, 10000].map((records) => ({
  records,
  treeRuntime: Number((0.00045 * records * Math.log2(records + 1)).toFixed(1)),
  knnRuntime: Number((0.0022 * records).toFixed(1)),
  treeMemory: Number((2 + 0.0035 * records).toFixed(1)),
  knnMemory: Number((2 + 0.0052 * records).toFixed(1)),
}))

function ComplexityPage() {
  const [selectedModel, setSelectedModel] = useState<ComplexityModel>('Decision Tree')
  const [metric, setMetric] = useState<ComplexityMetric>('runtime')
  const [recordCount, setRecordCount] = useState(1000)
  const row = complexityDemo.find((item) => item.records === recordCount) ?? complexityDemo[2]
  const runtime = selectedModel === 'Decision Tree' ? row.treeRuntime : row.knnRuntime
  const memory = selectedModel === 'Decision Tree' ? row.treeMemory : row.knnMemory
  const selectedColor = selectedModel === 'Decision Tree' ? '#06b6d4' : '#a78bfa'
  const timeDescription = selectedModel === 'Decision Tree'
    ? 'Typical prediction: O(h), where h is tree depth. A balanced tree has h ≈ log n; a highly unbalanced tree may have h = n.'
    : 'Typical prediction: O(n × d) for brute-force KNN, where n is the training-set size and d is the number of features.'
  const spaceDescription = selectedModel === 'Decision Tree'
    ? 'The trained tree stores split nodes and leaves. Memory depends on tree size, depth, and implementation.'
    : 'KNN typically retains the training examples, requiring O(n × d) storage.'
  const firstKey = metric === 'runtime' ? 'treeRuntime' : 'treeMemory'
  const secondKey = metric === 'runtime' ? 'knnRuntime' : 'knnMemory'
  const unit = metric === 'runtime' ? 'ms' : 'MB'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          title="Complexity analysis"
          description="Explore illustrative runtime, memory, and scalability for Decision Tree and KNN."
        />
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300">DEMO DATA</span>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
        These curves are synthetic UI examples, not measured execution times or memory consumption. Actual benchmarks will be connected after backend testing. Theoretical complexities below are separate from these example values.
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">Selected model</h3>
          <p className="mt-1 text-xs text-slate-400">Switch algorithms to explore their complexity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['Decision Tree', 'KNN'] as ComplexityModel[]).map((model) => (
            <button key={model} onClick={() => setSelectedModel(model)}
              aria-pressed={selectedModel === model}
              className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${selectedModel === model ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500/50'}`}>
              {model}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Example prediction runtime" value={`${runtime.toFixed(1)} ms`} note={`${recordCount.toLocaleString()} training records · synthetic estimate`} icon="◷" color="bg-cyan-500/10 text-cyan-300" />
        <MetricCard title="Example memory usage" value={`${memory.toFixed(1)} MB`} note={`${recordCount.toLocaleString()} training records · synthetic estimate`} icon="▤" color="bg-violet-500/10 text-violet-300" />
        <MetricCard title="Dataset size" value={recordCount.toLocaleString()} note="Select another size below" icon="▦" color="bg-emerald-500/10 text-emerald-300" />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">Scalability comparison</h3>
            <p className="mt-1 text-xs text-slate-500">Illustrative values as training-set size increases</p>
          </div>
          <div className="flex gap-2">
            {(['runtime', 'memory'] as ComplexityMetric[]).map((value) => (
              <button key={value} onClick={() => setMetric(value)} aria-pressed={metric === value}
                className={`rounded-lg px-4 py-2 text-sm capitalize transition ${metric === value ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}>{value}</button>
            ))}
          </div>
        </div>
        <div className="mt-6 h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={complexityDemo} margin={{ top: 8, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#203047" strokeDasharray="3 3" />
              <XAxis dataKey="records" type="number" domain={[0, 10000]} ticks={[0, 2000, 4000, 6000, 8000, 10000]}
                tickFormatter={(v: number) => v === 0 ? '0' : `${v / 1000}k`} stroke="#7186a2" tick={{ fontSize: 11 }} />
              <YAxis stroke="#7186a2" tick={{ fontSize: 11 }} unit={` ${unit}`} width={65} />
              <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)} ${unit}`, String(name)]}
                contentStyle={{ backgroundColor: '#0c192b', border: '1px solid #28405a', borderRadius: 10, color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey={firstKey} name="Decision Tree" stroke="#06b6d4" strokeWidth={3}
                dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey={secondKey} name="KNN" stroke="#a78bfa" strokeWidth={3}
                dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500">X-axis: number of training records · Y-axis: example {metric === 'runtime' ? 'prediction time (ms)' : 'memory (MB)'} · Not benchmark measurements</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-5">
          <label htmlFor="dataset-size" className="text-sm text-slate-300">Explore dataset size</label>
          <select id="dataset-size" value={recordCount} onChange={(e) => setRecordCount(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:border-cyan-500">
            {complexityDemo.map((item) => <option key={item.records} value={item.records}>{item.records.toLocaleString()} records</option>)}
          </select>
          <span className="text-xs text-slate-500">Cards above update with this selection.</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Theoretical analysis</span>
          <h3 className="mt-3 text-lg font-semibold text-white">Time complexity</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">{timeDescription}</p>
          <p className="mt-3 text-xs text-slate-500">Training cost varies by implementation, split strategy, and data shape.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: selectedColor }}>Theoretical analysis</span>
          <h3 className="mt-3 text-lg font-semibold text-white">Space complexity</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">{spaceDescription}</p>
          <p className="mt-3 text-xs text-slate-500">Actual RAM use also includes data structures, overhead, and temporary allocations.</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">Next integration step: replace the synthetic series with measured benchmark output from the C++ backend.</p>
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
              <span className="text-xs font-medium text-slate-300">Development mode</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Sample data is active. API connection is pending.
            </p>
          </div>
          <p className="px-2 pt-4 text-[10px] text-slate-600">INIDS · Frontend prototype</p>
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
              ● Offline demo
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-cyan-300">
              M3
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-8">
          {renderPage()}
          <footer className="mt-10 border-t border-slate-800 py-5 text-center text-xs text-slate-600">
            INIDS · Intelligent Network Intrusion Detection System · Frontend prototype
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
