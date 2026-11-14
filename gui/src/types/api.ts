export type DetectionResult = {
  id: number | string
  label: string
  classIndex: number
  isMalicious: boolean
  confidence: number
  actualLabel: string
  correct: boolean
  severity?: 'Low' | 'Medium' | 'High'
}

export type DashboardData = {
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
}

export type DatasetItem = {
  name: string
  records: number | null
  features: number | null
  status: string
}

export type DatasetSummary = {
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
}

export type DatasetPreview = {
  datasetName: string
  columns: string[]
  rows: string[][]
  previewRows: number
  totalRows: number | null
}

export type RetainedModelInfo = {
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

export type EvaluationModel = 'decision_tree' | 'knn'

export type EvaluationMetrics = {
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

export type EvaluationReport = {
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

export type EvaluationResponse = {
  datasetName: string
  trainedOn?: string
  evaluatedOn?: string
  mode?: string
  models: Partial<Record<EvaluationModel, EvaluationReport>>
}

export type ComplexityModel = 'decision_tree' | 'knn'
export type ComplexityMetric = 'predictMs' | 'trainMs'

export type ComplexityRun = {
  fraction: number
  memoryBytes: number | null
  model: ComplexityModel
  predictMs: number
  predictMsPerRow: number
  testRows: number
  trainMs: number
  trainRows: number
}

export type ComplexityResponse = {
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
