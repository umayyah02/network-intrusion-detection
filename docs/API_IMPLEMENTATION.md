# Backend API: what is implemented

Written by Member 2 (backend server) in answer to `API_CONTRACT.md` v0.2, which asks the backend developer to confirm which endpoints exist, document extra error codes, and report differences to the integration member (Member 4).
TypeScript types for every response: `docs/api-types.ts`. A test that exercises every endpoint: `tests/api_smoke.sh`.

Example values are illustrative, except the confusion matrix and per-class numbers in `/api/metrics`, which come from a real KNN run on the A2 test split.

## 1. Confirmation against contract v0.2

| Contract endpoint | Status | Notes |
|---|---|---|
| `GET /api/health` | Implemented | |
| `GET /api/datasets` | Implemented | lists CSV files in the server's data folder; counts only for the loaded one |
| `POST /api/dataset` | Implemented | multipart upload **or** `{"path": ...}` for a file already on the server |
| `POST /api/detect` | Implemented | always a background job, `202` with `jobId` |
| `GET /api/detect/status` | Implemented | states `idle`, `running`, `done`, `failed` |
| `GET /api/detections` | Implemented | filter `all`, `threats`, `normal` |
| `GET /api/summary` | Implemented | from the finished detection |
| `GET /api/metrics` | Implemented | both models side by side; rows = actual, columns = predicted |
| `GET /api/complexity` | Implemented | needs `POST /api/complexity/run` first (see 3.12); memory is `null` |

Extra endpoints beyond the contract (the frontend may ignore them): `GET /api/dataset/files`, `GET /api/dataset/summary`, `POST /api/dataset/load`, `GET /api/detections/{id}`, `GET /api/threats`, `GET /api/threats/{id}`, `GET /api/dashboard`, `POST /api/complexity/run`.

## 2. Running and conventions

```
inids_server --data-dir data                  # http://127.0.0.1:8080
```

| Option | Default | Meaning |
|---|---|---|
| `--port` | 8080 | |
| `--host` | 127.0.0.1 | local only. If a client cannot reach `http://localhost:8080`, use `http://127.0.0.1:8080` |
| `--data-dir` | `data` | folder with the CSV files; uploads go to `uploads/` inside it |
| `--dataset` | none | CSV (relative to the data dir) to load at start-up |
| `--allow-origin` | `*` | CORS origin; the React dev server can call the API directly |
| `--enable-severity` | off | adds a derived Low/Medium/High severity (see 4) |

- JSON everywhere (camelCase), except the CSV upload (`multipart/form-data`). Fractions are 0 to 1, durations in milliseconds, times ISO 8601 UTC.
- Class order: `BENIGN` = 0, `DoS` = 1, `PortScan` = 2, `BruteForce` = 3. `BENIGN` is normal (`isMalicious: false`), the rest are malicious.
- **One background job at a time** (detection or complexity experiment): starting another gives `409 JOB_RUNNING`.
- Loading a dataset clears all earlier results.
- Results describe the **test split** of the loaded file (20% of its rows, same split for both models).

### Errors

```json
{ "error": { "code": "INVALID_CSV", "message": "cannot open data/x.csv" } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | invalid JSON, unknown field, value out of range (the message names the field) |
| 400 | `INVALID_CSV` | the file is not a readable dataset (not `.csv`, empty, cannot be prepared) |
| 404 | `NOT_FOUND`, `FILE_NOT_FOUND` | unknown endpoint, id, or CSV |
| 409 | `NO_DATASET`, `NO_RESULTS`, `JOB_RUNNING`, `DATASET_LOADING` | the call does not fit the current state |
| 413 | `TOO_LARGE` | request body above 512 MB |
| 500 | `INTERNAL_ERROR`, `WRITE_FAILED` | server-side problem |

## 3. Endpoints

### 3.1 `GET /api/health`
`{"status": "ok"}`

### 3.2 `GET /api/datasets`
```json
{ "datasets": [
  { "name": "sample_A2.csv", "records": 2997, "features": 20, "status": "Loaded", "sizeBytes": 412345 },
  { "name": "sample_V.csv",  "records": null, "features": null, "status": "Available", "sizeBytes": 198765 } ] }
```
`records` is the number of usable rows after cleaning. `features` is the number of columns the models use after feature selection. Both are `null` until a file is loaded (nothing is guessed). `status` is `Loaded` or `Available`.

### 3.3 `POST /api/dataset`
Upload a file (`multipart/form-data`, field `file`) or name one in the data folder:
```
curl -X POST http://127.0.0.1:8080/api/dataset -F file=@flows.csv
curl -X POST http://127.0.0.1:8080/api/dataset -d '{"path":"sample_A2.csv"}'
```
Loads, cleans and prepares the data (stratified 80/20 split, seed 42, feature selection, scaling fitted on the training part). Response:
```json
{ "name": "sample_A2.csv", "rows": 2997, "columns": 20, "skippedRows": null, "summary": { "...": "see 3.4" } }
```
`columns` is the number of feature columns used by the models, not the raw CSV width. `skippedRows` is `null` because the data layer does not expose its cleaning report yet. Errors: `400`, `404`, `409`.
`POST /api/dataset/load` takes the same input and returns only the `summary` object.

### 3.4 `GET /api/dataset/summary`
```json
{ "loaded": true, "name": "sample_A2.csv", "loadedAt": "2026-10-29T19:00:07Z",
  "rows": { "total": 2997, "train": 2397, "test": 600 },
  "featureCount": 20, "features": ["Flow Duration", "..."],
  "classNames": ["BENIGN", "DoS", "PortScan", "BruteForce"],
  "classes": [ { "index": 0, "name": "BENIGN", "total": 1498, "train": 1198, "test": 300 } ] }
```
Nothing loaded: `{"loaded": false}`.

### 3.5 `POST /api/detect`
```json
{ "model": "decision_tree" }
{ "model": "knn", "params": { "k": 5, "p": 2, "distanceWeighted": true } }
```
`model`: `decision_tree` or `knn`. `params` is optional; missing values use the settings chosen by cross-validation on the training split. Unknown or out-of-range values give `400`.

| Model | Param | Default | Range |
|---|---|---|---|
| knn | `k` | 1 | 1 to 10000 |
| knn | `p` (1 = Manhattan, 2 = Euclidean) | 1 | 1 to 10 |
| knn | `distanceWeighted` | false | true / false |
| decision_tree | `maxDepth` (0 = unlimited) | 0 | 0 to 64 |
| decision_tree | `minSamplesLeaf` | 2 | 1 and up |
| decision_tree | `minSamplesSplit` | 2 | 2 and up |
| decision_tree | `minImpurityDecrease` | 0 | 0 to 1 |

Response `202`: `{"jobId": 1, "type": "detect", "state": "running", "model": "knn", "params": {...}}` (`params` = values actually used). Errors: `400`, `409 NO_DATASET`, `409 JOB_RUNNING`.

### 3.6 `GET /api/detect/status`
Status of the current or latest job (detection or complexity). Poll every 300 to 500 ms while `running`.
```json
{ "jobId": 1, "type": "detect", "state": "running", "stage": "predicting", "model": "knn",
  "progress": 0.455, "message": "", "startedAt": "...", "finishedAt": "", "elapsedMs": 849.7, "resultReady": false }
```
`state`: `idle` (no job since the dataset was loaded), `running`, `done`, `failed`. On `failed`, `message` holds the error text. `stage`: `training`, `predicting`, `evaluating`, `done` (or `failed`).

### 3.7 `GET /api/detections`
One row per test flow, for the results table. Query (all optional):

| Query | Values | Default |
|---|---|---|
| `model` | `decision_tree`, `knn` | the model that finished last |
| `filter` | `all`, `threats` (malicious), `normal` | `all` |
| `search` | text; matches label, actual label, id | none |
| `attackType` | a malicious class name | all |
| `minConfidence` | 0 to 1 | 0 |
| `sort` | `id`, `confidence`, `label` (`severity` only with `--enable-severity`) | `id` |
| `order` | `asc`, `desc` | `asc` |
| `page`, `pageSize` | 1 and up, 1 to 100000 | **all rows in one page** unless `pageSize` is given |

```json
{ "model": "knn", "filter": "all", "total": 600, "totalAll": 600, "page": 1, "pageSize": 600, "pages": 1,
  "items": [ { "id": 83, "label": "PortScan", "classIndex": 2, "isMalicious": true,
               "confidence": 1.0, "actualLabel": "PortScan", "correct": true } ] }
```
- `label` is the predicted **class name**; `classIndex` is the same class as a number.
- `actualLabel` is the true class from the dataset. `isMalicious: true` with `actualLabel: "BENIGN"` is a false alarm.
- `confidence` is real model output (see 5). `severity` appears only with `--enable-severity`.
- No source IP, destination IP or timestamp: the dataset has no such columns, so none are returned.

`GET /api/detections/{id}?model=knn` returns one row plus `features`: `[{"name", "value"}]` in **scaled units** (log then z-score), not raw values.

`GET /api/threats` and `GET /api/threats/{id}` are the same with `filter` fixed to `threats` (and a default page size of 50).

### 3.8 `GET /api/summary?model=knn`
```json
{ "model": "knn", "datasetName": "sample_A2.csv", "scope": "predictions on the test split",
  "total": 600, "normal": 302, "malicious": 298,
  "classCounts": [ { "classIndex": 0, "name": "BENIGN", "isMalicious": false, "count": 302 },
                   { "classIndex": 1, "name": "DoS", "isMalicious": true, "count": 121 } ] }
```
Counts are the model's **predictions**. `409 NO_RESULTS` before any detection finished.

### 3.9 `GET /api/dashboard?model=knn`
Same totals plus `accuracy` and `attackTypes: [{name, count}]` (predicted attack types). With `--enable-severity` it also has `severity: [{level, count}]`.

### 3.10 `GET /api/metrics`
Measured on the test split. A model appears once its detection has finished; nothing run yet gives `{"available": [], "models": {}}`.
```json
{ "available": ["decision_tree", "knn"], "datasetName": "sample_A2.csv",
  "classNames": ["BENIGN", "DoS", "PortScan", "BruteForce"], "testRows": 600,
  "models": { "knn": {
    "model": "knn", "params": { "k": 1, "p": 1.0, "distanceWeighted": false },
    "info": { "storedTrainingRows": 2397 }, "trainRows": 2397, "testRows": 600, "finishedAt": "...",
    "metrics": {
      "accuracy": 0.9833, "macroF1": 0.9828, "falseAlarmRate": 0.0133, "falseAlarms": 4, "benignRows": 300,
      "detectionRate": 0.98, "alertPrecision": 0.9866, "flagged": 298,
      "perClass": [ { "name": "BENIGN", "precision": 0.9801, "recall": 0.9867, "f1": 0.9834, "support": 300 },
                    { "name": "DoS", "precision": 0.9835, "recall": 0.9917, "f1": 0.9876, "support": 120 },
                    { "name": "PortScan", "precision": 0.9890, "recall": 1.0, "f1": 0.9945, "support": 90 },
                    { "name": "BruteForce", "precision": 0.9884, "recall": 0.9444, "f1": 0.9659, "support": 90 } ],
      "confusion": { "labels": ["BENIGN", "DoS", "PortScan", "BruteForce"],
                     "matrix": [[296,2,1,1],[1,119,0,0],[0,0,90,0],[5,0,0,85]] } },
    "timing": { "trainMs": 0.4, "predictMs": 44.3, "predictMsPerRow": 0.0739 },
    "totals": { "total": 600, "normal": 302, "threats": 298 } } } }
```
`confusion.matrix[actual][predicted]` in the order of `confusion.labels`. `falseAlarmRate` = benign flows flagged / all benign. `detectionRate` = malicious flows flagged as any attack / all malicious. `alertPrecision` = real attacks among flagged flows. For the tree, `info` has `depth`, `nodes`, `leaves` and the top `featureImportance`.

### 3.11 `POST /api/complexity/run`
Starts a background timing experiment (shares the job slot and status endpoint). All fields optional:
```json
{ "models": ["decision_tree", "knn"], "fractions": [0.1, 0.25, 0.5, 1.0], "repeats": 1 }
```
For each model and fraction: train on a stratified share of the training rows, predict the full test split. `202` with the job, then poll 3.6.

### 3.12 `GET /api/complexity`
```json
{ "ready": true, "datasetName": "sample_A2.csv", "repeats": 1, "finishedAt": "...",
  "runs": [ { "model": "decision_tree", "fraction": 0.5, "trainRows": 1198, "testRows": 600,
              "trainMs": 14.2, "predictMs": 0.1, "predictMsPerRow": 0.00017, "memoryBytes": null } ],
  "theory": { "variables": "n = training records, f = features, h = tree height",
              "decision_tree": { "train": "O(n f log n)", "predict": "O(h) per record", "storage": "..." },
              "knn": { "train": "none (stores the training rows)", "predict": "...", "storage": "O(n f)" } } }
```
Before any run: `{"ready": false, "runs": [], "theory": {...}}`. Times are measured wall-clock milliseconds on the server. **Memory is not measured**, so `memoryBytes` is `null` (as the contract asks).

## 4. Severity

The contract says not to invent severity, and the PRD asks the team to agree a mapping (open question 3). So the server **omits severity by default**. If the team agrees on a mapping, start the server with `--enable-severity`; the mapping then in `src/api/severity.h` is: `DoS` = High, `BruteForce` = Medium, `PortScan` = Low, and confidence below 0.6 lowers it by one level. Change that one function to change the rule.

## 5. Confidence

Real model output, not invented: for KNN the share of the K nearest neighbours that voted for the predicted class; for the Decision Tree the share of the predicted class among the training rows in the leaf.
With **K = 1** (the cross-validated default) every KNN confidence is exactly 1.0, and a deep tree has mostly pure leaves, so most values are 1.0. Do not design the UI around a wide spread. Use `k` of 3 or more if the demo needs varied confidence.

## 6. Points for Member 4 to confirm

1. `label` in detection rows is the class **name** (`"DoS"`), with the number in `classIndex`. The contract's class table could also be read as a number; tell us if the frontend wants the number as `label`.
2. `POST /api/dataset` also accepts `{"path": ...}` for files already in the data folder, so the demo does not need an upload every time.
3. `columns` in the upload reply is the feature count the models use, and `skippedRows` is `null` until the data layer exposes its cleaning report.
4. Severity stays off until the team agrees a mapping.
5. `/api/detections` returns every test row unless `pageSize` is given. Add paging in the UI if the test split gets large.
