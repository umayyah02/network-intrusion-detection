// TypeScript types for the INIDS backend API. Keep in sync with docs/API_IMPLEMENTATION.md.
// Fractions (accuracy, rates, confidence) are numbers from 0 to 1. Times are ISO 8601 UTC strings.

export type ModelName = "decision_tree" | "knn";
export type Severity = "Low" | "Medium" | "High";
export type JobState = "idle" | "running" | "done" | "failed";
export type JobType = "detect" | "complexity";

export type ErrorCode =
  | "BAD_REQUEST"
  | "INVALID_CSV"
  | "NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "NO_DATASET"
  | "NO_RESULTS"
  | "JOB_RUNNING"
  | "DATASET_LOADING"
  | "TOO_LARGE"
  | "INTERNAL_ERROR"
  | "WRITE_FAILED";

export interface ApiErrorBody {
  error: { code: ErrorCode | string; message: string };
}

export interface HealthResponse {
  status: "ok";
}

// ---------- datasets ----------
export interface DatasetListItem {
  name: string; // path relative to the server's data folder
  records: number | null; // null until the file is loaded
  features: number | null; // features the models use; null until loaded
  status: "Loaded" | "Available";
  sizeBytes: number;
}
export interface DatasetsResponse {
  datasets: DatasetListItem[];
}

export interface ClassCount {
  index: number;
  name: string;
  total: number;
  train: number;
  test: number;
}
export interface DatasetSummaryLoaded {
  loaded: true;
  name: string;
  loadedAt: string;
  rows: { total: number; train: number; test: number };
  featureCount: number;
  features: string[];
  classNames: string[]; // index 0 = BENIGN, everything else is malicious
  classes: ClassCount[];
}
export type DatasetSummary = DatasetSummaryLoaded | { loaded: false };

// POST /api/dataset: multipart/form-data with a "file" field, or this JSON body.
export interface LoadDatasetRequest {
  path: string;
}
// Reply of POST /api/dataset. (POST /api/dataset/load returns just `summary`.)
export interface DatasetLoadResponse {
  name: string;
  rows: number; // usable rows after cleaning
  columns: number; // feature columns the models use
  skippedRows: number | null; // null: the data layer does not report it yet
  summary: DatasetSummaryLoaded;
}

// ---------- detection ----------
export interface KnnParams {
  k: number;
  p: number;
  distanceWeighted: boolean;
}
export interface TreeParams {
  maxDepth: number;
  minSamplesLeaf: number;
  minSamplesSplit: number;
  minImpurityDecrease: number;
}
export type DetectRequest =
  | { model: "knn"; params?: Partial<KnnParams> }
  | { model: "decision_tree"; params?: Partial<TreeParams> };

export interface DetectStarted {
  jobId: number;
  type: "detect";
  state: "running";
  model: ModelName;
  params: KnnParams | TreeParams; // values actually used
}

export interface JobStatus {
  jobId: number;
  type: JobType | ""; // "" while idle
  state: JobState;
  stage: string;
  model: ModelName | ""; // "" for complexity jobs
  progress: number; // 0 to 1
  message: string; // error text when state === "failed"
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  resultReady: boolean;
}

// ---------- detections ----------
export interface Detection {
  id: number; // row number in the test split
  label: string; // predicted class name, e.g. "DoS"
  classIndex: number; // predicted class number (BENIGN = 0)
  isMalicious: boolean;
  confidence: number; // real model output; with K = 1 it is always 1
  actualLabel: string; // true class; isMalicious && actualLabel === "BENIGN" is a false alarm
  correct: boolean;
  severity?: Severity; // only when the server runs with --enable-severity
}
export interface DetectionsResponse {
  model: ModelName;
  filter: "all" | "threats" | "normal";
  total: number; // after filters
  totalAll: number; // before filters (all rows, or all threats for /api/threats)
  page: number;
  pageSize: number;
  pages: number;
  items: Detection[];
}
export interface DetectionsQuery {
  model?: ModelName;
  filter?: "all" | "threats" | "normal";
  search?: string;
  attackType?: string;
  minConfidence?: number;
  severity?: Severity; // only with --enable-severity
  sort?: "id" | "confidence" | "label" | "severity";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number; // omit to get every row
}
export interface DetectionDetail extends Detection {
  model: ModelName;
  features: { name: string; value: number }[]; // scaled units (log + z-score)
}

// ---------- summary and dashboard ----------
export interface Totals {
  total: number;
  normal: number;
  threats: number;
}
export interface SummaryResponse {
  model: ModelName;
  datasetName: string;
  scope: string;
  total: number;
  normal: number;
  malicious: number;
  classCounts: { classIndex: number; name: string; isMalicious: boolean; count: number }[];
}
export interface DashboardResponse {
  model: ModelName;
  datasetName: string;
  finishedAt: string;
  totals: Totals;
  accuracy: number;
  attackTypes: { name: string; count: number }[]; // predicted types
  severity?: { level: Severity; count: number }[]; // only with --enable-severity
}

// ---------- metrics ----------
export interface PerClassMetrics {
  name: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}
export interface ModelMetrics {
  model: ModelName;
  params: KnnParams | TreeParams;
  info: {
    storedTrainingRows?: number; // knn
    depth?: number; // decision tree
    nodes?: number;
    leaves?: number;
    featureImportance?: { name: string; importance: number }[];
  };
  trainRows: number;
  testRows: number;
  finishedAt: string;
  metrics: {
    accuracy: number;
    macroF1: number;
    falseAlarmRate: number;
    falseAlarms: number;
    benignRows: number;
    detectionRate: number;
    alertPrecision: number;
    flagged: number;
    perClass: PerClassMetrics[];
    confusion: { labels: string[]; matrix: number[][] }; // matrix[actual][predicted]
  };
  timing: { trainMs: number; predictMs: number; predictMsPerRow: number };
  totals: Totals;
}
export interface MetricsResponse {
  available: ModelName[];
  datasetName?: string;
  classNames?: string[];
  testRows?: number;
  models: Partial<Record<ModelName, ModelMetrics>>;
}

// ---------- complexity ----------
export interface ComplexityRequest {
  models?: ModelName[];
  fractions?: number[]; // each above 0 and at most 1
  repeats?: number; // 1 to 10
}
export interface ComplexityStarted {
  jobId: number;
  type: "complexity";
  state: "running";
  models: ModelName[];
  fractions: number[];
  repeats: number;
}
export interface ComplexityRun {
  model: ModelName;
  fraction: number;
  trainRows: number;
  testRows: number;
  trainMs: number;
  predictMs: number;
  predictMsPerRow: number;
  memoryBytes: number | null; // not measured: always null for now
}
export interface ComplexityTheory {
  variables: string;
  decision_tree: { train: string; predict: string; storage: string };
  knn: { train: string; predict: string; storage: string };
}
export interface ComplexityResponse {
  ready: boolean;
  datasetName?: string;
  repeats?: number;
  finishedAt?: string;
  notes?: string;
  runs: ComplexityRun[];
  theory: ComplexityTheory;
}
