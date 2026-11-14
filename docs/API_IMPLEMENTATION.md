
# Backend API: Implemented Reference

This document describes the implemented C++ backend API, including its endpoints, request parameters, responses, and current limitations.

The API contract is documented in `docs/API_CONTRACT.md`.

TypeScript response types are maintained in `docs/api-types.ts`. API smoke tests are located in `tests/api_smoke.sh`.

Example metric values in this document are historical A2 results unless explicitly stated otherwise. They should not be treated as current A3 results.

## 1. Implemented Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend health |
| GET | `/api/datasets` | List available datasets |
| GET | `/api/dataset/files` | List dataset files |
| GET | `/api/dataset/summary` | Get loaded dataset summary |
| GET | `/api/dataset/preview` | Preview dataset rows |
| POST | `/api/dataset` | Load a dataset |
| POST | `/api/dataset/load` | Load a dataset and return its summary |
| GET | `/api/models` | List supported models |
| POST | `/api/detect` | Start model training and detection |
| GET | `/api/detect/status` | Check detection job status |
| POST | `/api/predict` | Predict using a retained model |
| POST | `/api/evaluate` | Run the prediction/evaluation workflow |
| GET | `/api/predict/status` | Check prediction job status |
| GET | `/api/detections` | Retrieve detection records |
| GET | `/api/detections/{id}` | Retrieve one detection record |
| GET | `/api/threats` | Retrieve malicious records |
| GET | `/api/threats/{id}` | Retrieve one threat record |
| GET | `/api/summary` | Retrieve detection summary |
| GET | `/api/metrics` | Retrieve evaluation metrics |
| GET | `/api/dashboard` | Retrieve dashboard data |
| POST | `/api/complexity/run` | Start complexity analysis |
| GET | `/api/complexity` | Retrieve complexity results |

Detection, prediction, and complexity operations run as background jobs and return HTTP `202`.

There is no `/api/docs` endpoint in the current implementation.

## 2. Running and Conventions

The server runs on `127.0.0.1:8080` by default.

```bash
inids_server --data-dir data
```

| Option | Default | Meaning |
|---|---|---|
| `--port` | 8080 | API server port |
| `--host` | 127.0.0.1 | Server bind address |
| `--data-dir` | `data` | Folder containing CSV files; uploads are stored in `uploads/` inside it |
| `--dataset` | none | CSV file, relative to the data directory, to load at startup |
| `--allow-origin` | `*` | Allowed CORS origin |
| `--enable-severity` | off | Enables derived Low/Medium/High severity |

- The API accepts JSON requests and multipart CSV uploads.
- JSON fields use camelCase.
- Fractions range from 0 to 1, durations are in milliseconds, and timestamps use ISO 8601 UTC.
- Class order: `BENIGN` = 0, `DoS` = 1, `PortScan` = 2, `BruteForce` = 3.
- `BENIGN` is normal (`isMalicious: false`). The other classes are malicious.
- Only one background job can run at a time. A new job while another is running returns `409 JOB_RUNNING`.
- Loading a new dataset clears previous detection results.
- Detection results describe the test split, normally 20% of the loaded dataset.

### Errors

Errors use this JSON structure:

```json
{
  "error": {
    "code": "INVALID_CSV",
    "message": "cannot open data/x.csv"
  }
}
```

| Status | Common codes | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST`, `INVALID_CSV` | Invalid request or unusable CSV |
| 404 | `NOT_FOUND`, `FILE_NOT_FOUND` | Unknown endpoint, record ID, or CSV file |
| 409 | `NO_DATASET`, `NO_MODEL`, `NO_RESULTS`, `JOB_RUNNING`, `DATASET_LOADING` | Request conflicts with the current backend state |
| 413 | `TOO_LARGE` | Request body exceeds 512 MB |
| 500 | `INTERNAL_ERROR`, `WRITE_FAILED` | Server-side problem |

## 3. Endpoints

### 3.1 `GET /api/health`

Checks whether the backend is responding.

Example response:

```json
{"status": "ok"}
```

### 3.2 `GET /api/datasets`

Lists available dataset files.

Example response:

```json
{
  "datasets": [
    {
      "name": "sample_A2.csv",
      "records": 2997,
      "features": 20,
      "status": "Loaded",
      "sizeBytes": 412345
    },
    {
      "name": "sample_V.csv",
      "records": null,
      "features": null,
      "status": "Available",
      "sizeBytes": 198765
    }
  ]
}
```

`records` represents usable rows after cleaning. `features` represents the number of model input features. These values can be `null` until the file has been loaded and processed.

### 3.3 `GET /api/dataset/files`

Lists CSV files available in the configured dataset directory.

### 3.4 `GET /api/dataset/preview`

Previews rows from the currently loaded dataset.

The limit query parameter controls the number of preview rows. It accepts values from 1 to 100 and defaults to 20. A dataset must be loaded first.

### 3.5 `POST /api/dataset`

Loads a dataset from the data directory or uploads a CSV file.

Upload using multipart form data:

```bash
curl -X POST http://127.0.0.1:8080/api/dataset -F file=@flows.csv
```

Load a file already in the data directory:

```bash
curl -X POST http://127.0.0.1:8080/api/dataset -H "Content-Type: application/json" -d "{\"path\":\"sample_A2.csv\"}"
```

The backend cleans and prepares the dataset, performs a stratified 80/20 split, and fits preprocessing on the training data.

Example response:

```json
{
  "name": "sample_A2.csv",
  "rows": 2997,
  "columns": 20,
  "skippedRows": null,
  "summary": {
    "...": "see dataset summary"
  }
}
```

`columns` is the number of feature columns used by the models, not the raw CSV width. `skippedRows` is currently `null` because the data layer does not expose its cleaning report.

### 3.6 `POST /api/dataset/load`

Accepts the same input formats as `POST /api/dataset`, but returns the dataset summary.

### 3.7 `GET /api/dataset/summary`

Returns information about the currently loaded dataset.

Example response:

```json
{
  "loaded": true,
  "name": "sample_A2.csv",
  "loadedAt": "2026-10-29T19:00:07Z",
  "rows": {
    "total": 2997,
    "train": 2397,
    "test": 600
  },
  "featureCount": 20,
  "features": ["Flow Duration", "..."],
  "classNames": ["BENIGN", "DoS", "PortScan", "BruteForce"],
  "classes": [
    {
      "index": 0,
      "name": "BENIGN",
      "total": 1498,
      "train": 1198,
      "test": 300
    }
  ]
}
```

If no dataset is loaded:

```json
{"loaded": false}
```

### 3.8 `GET /api/models`

Lists the supported machine learning models.

The supported model identifiers are `knn` and `decision_tree`.

### 3.9 `POST /api/detect`

Starts model training and detection using the currently loaded dataset.

Example requests:

```json
{"model": "decision_tree"}
```

```json
{
  "model": "knn",
  "params": {
    "k": 5,
    "p": 2,
    "distanceWeighted": true
  }
}
```

`model` must be `decision_tree` or `knn`. `params` is optional. Missing parameters use the backend defaults. Unknown or out-of-range values return `400`.

| Model | Parameter | Default | Range |
|---|---|---:|---|
| knn | `k` | 1 | 1 to 10000 |
| knn | `p` (1 = Manhattan, 2 = Euclidean) | 2.0 | 1 to 10 |
| knn | `distanceWeighted` | false | true / false |
| decision_tree | `maxDepth` (0 = unlimited) | 0 | 0 to 64 |
| decision_tree | `minSamplesLeaf` | 2 | 1 to 1000000 |
| decision_tree | `minSamplesSplit` | 2 | 2 to 1000000 |
| decision_tree | `minImpurityDecrease` | 0 | 0 to 1 |

A successful request returns HTTP `202`:

```json
{
  "jobId": 1,
  "type": "detect",
  "state": "running",
  "model": "knn",
  "params": {}
}
```

The returned `params` contain the values actually used.

Errors include `400`, `409 NO_DATASET`, `409 DATASET_LOADING`, and `409 JOB_RUNNING`.

### 3.10 `GET /api/detect/status`

Returns the current or latest background job status.

Poll this endpoint every 300–500 ms while a job is running.

Example response:

```json
{
  "jobId": 1,
  "type": "detect",
  "state": "running",
  "stage": "predicting",
  "model": "knn",
  "progress": 0.455,
  "message": "",
  "startedAt": "...",
  "finishedAt": "",
  "elapsedMs": 849.7,
  "resultReady": false
}
```

Possible states are `idle`, `running`, `done`, and `failed`. A failed job includes an error message.

Stages include `training`, `predicting`, `evaluating`, `done`, and `failed`.

### 3.11 `POST /api/predict`

Runs prediction using a previously trained and retained model.

The request can provide a CSV path or upload a CSV file. It can also specify the model.

A retained model must exist first. Otherwise, the API returns `409 NO_MODEL`.

The model is retained in backend memory and is lost when the backend restarts.

### 3.12 `POST /api/evaluate`

Runs the prediction/evaluation workflow using the same handler as `POST /api/predict`.

### 3.13 `GET /api/predict/status`

Returns the status of the prediction job.

It uses the same job-status structure as `GET /api/detect/status`.

### 3.14 `GET /api/detections`

Returns detection records for the selected model.

Optional query parameters:

| Parameter | Values | Default |
|---|---|---|
| `model` | `decision_tree`, `knn` | Most recently completed model |
| `filter` | `all`, `threats`, `normal` | `all` |
| `search` | Text | None |
| `attackType` | Malicious class name | All |
| `minConfidence` | 0 to 1 | 0 |
| `sort` | `id`, `confidence`, `label`, `severity` | `id` |
| `order` | `asc`, `desc` | `asc` |
| `page` | 1 or greater | 1 |
| `pageSize` | 1 to 100000 | All rows |

Severity sorting is available only when severity is enabled.

Example response:

```json
{
  "model": "knn",
  "filter": "all",
  "total": 600,
  "totalAll": 600,
  "page": 1,
  "pageSize": 600,
  "pages": 1,
  "items": [
    {
      "id": 83,
      "label": "PortScan",
      "classIndex": 2,
      "isMalicious": true,
      "confidence": 1.0,
      "actualLabel": "PortScan",
      "correct": true
    }
  ]
}
```

- `label` is the predicted class name.
- `classIndex` is its numeric class index.
- `actualLabel` is the true class from the dataset.
- A malicious prediction with `actualLabel: "BENIGN"` is a false alarm.
- `confidence` is the model's confidence value.
- `severity` is included only when severity is enabled.

The dataset does not provide source IP, destination IP, or timestamp fields, so these are not returned.

### 3.15 `GET /api/detections/{id}`

Returns one detection record and its feature values.

Example query:

```text
GET /api/detections/83?model=knn
```

The response includes `features` as name/value pairs. Feature values are scaled values, not raw CSV values.

### 3.16 `GET /api/threats`

Returns malicious detection records. It uses the same filters as `/api/detections`, with the filter fixed to `threats`.

Its default page size is 50.

### 3.17 `GET /api/threats/{id}`

Returns one malicious detection record.

### 3.18 `GET /api/summary`

Returns prediction totals for the selected model.

Example:

```text
GET /api/summary?model=knn
```

Example response:

```json
{
  "model": "knn",
  "datasetName": "sample_A2.csv",
  "scope": "predictions on the test split",
  "total": 600,
  "normal": 302,
  "malicious": 298,
  "classCounts": [
    {
      "classIndex": 0,
      "name": "BENIGN",
      "isMalicious": false,
      "count": 302
    },
    {
      "classIndex": 1,
      "name": "DoS",
      "isMalicious": true,
      "count": 121
    },
    {
      "classIndex": 2,
      "name": "PortScan",
      "isMalicious": true,
      "count": 91
    },
    {
      "classIndex": 3,
      "name": "BruteForce",
      "isMalicious": true,
      "count": 86
    }
  ]
}
```

These are predicted class counts. The endpoint returns `409 NO_RESULTS` if no detection has completed.

### 3.19 `GET /api/metrics`

Returns evaluation metrics for completed models.

If no model has run:

```json
{"available": [], "models": {}}
```

The following is a historical A2 KNN example, not the current A3 result:

```json
{
  "available": ["decision_tree", "knn"],
  "datasetName": "sample_A2.csv",
  "classNames": ["BENIGN", "DoS", "PortScan", "BruteForce"],
  "testRows": 600,
  "models": {
    "knn": {
      "model": "knn",
      "params": {
        "k": 1,
        "p": 1.0,
        "distanceWeighted": false
      },
      "info": {
        "storedTrainingRows": 2397
      },
      "trainRows": 2397,
      "testRows": 600,
      "finishedAt": "...",
      "metrics": {
        "accuracy": 0.9833,
        "macroF1": 0.9828,
        "falseAlarmRate": 0.0133,
        "falseAlarms": 4,
        "benignRows": 300,
        "detectionRate": 0.98,
        "alertPrecision": 0.9866,
        "flagged": 298,
        "perClass": [
          {
            "name": "BENIGN",
            "precision": 0.9801,
            "recall": 0.9867,
            "f1": 0.9834,
            "support": 300
          },
          {
            "name": "DoS",
            "precision": 0.9835,
            "recall": 0.9917,
            "f1": 0.9876,
            "support": 120
          },
          {
            "name": "PortScan",
            "precision": 0.9890,
            "recall": 1.0,
            "f1": 0.9945,
            "support": 90
          },
          {
            "name": "BruteForce",
            "precision": 0.9884,
            "recall": 0.9444,
            "f1": 0.9659,
            "support": 90
          }
        ],
        "confusion": {
          "labels": ["BENIGN", "DoS", "PortScan", "BruteForce"],
          "matrix": [
            [296, 2, 1, 1],
            [1, 119, 0, 0],
            [0, 0, 90, 0],
            [5, 0, 0, 85]
          ]
        }
      },
      "timing": {
        "trainMs": 0.4,
        "predictMs": 44.3,
        "predictMsPerRow": 0.0739
      },
      "totals": {
        "total": 600,
        "normal": 302,
        "threats": 298
      }
    }
  }
}
```

`confusion.matrix[actual][predicted]` follows the order in `confusion.labels`.

- `falseAlarmRate` = benign flows incorrectly flagged / all benign flows.
- `detectionRate` = malicious flows correctly flagged as attacks / all malicious flows.
- `alertPrecision` = actual attacks among all flagged flows.

For the decision tree, `info` also includes tree details such as depth, nodes, leaves, and feature importance.

### 3.20 `GET /api/dashboard`

Returns dashboard data for the selected model, including dataset information, prediction totals, accuracy, and predicted attack types.

When severity is enabled, the response also includes severity counts.

### 3.21 `POST /api/complexity/run`

Starts a background complexity experiment. It shares the single background job slot with detection and prediction.

Example request:

```json
{
  "models": ["decision_tree", "knn"],
  "fractions": [0.1, 0.25, 0.5, 1.0],
  "repeats": 1
}
```

All fields are optional.

For each model and training fraction, the backend trains on a stratified share of the training rows and predicts the full test split.

The request returns HTTP `202`. Poll `/api/detect/status` to check progress.

### 3.22 `GET /api/complexity`

Returns complexity experiment results.

Example response:

```json
{
  "ready": true,
  "datasetName": "sample_A2.csv",
  "repeats": 1,
  "finishedAt": "...",
  "runs": [
    {
      "model": "decision_tree",
      "fraction": 0.5,
      "trainRows": 1198,
      "testRows": 600,
      "trainMs": 14.2,
      "predictMs": 0.1,
      "predictMsPerRow": 0.00017,
      "memoryBytes": null
    }
  ],
  "theory": {
    "variables": "n = training records, f = features, h = tree height",
    "decision_tree": {
      "train": "O(n f log n)",
      "predict": "O(h) per record",
      "storage": "..."
    },
    "knn": {
      "train": "none (stores the training rows)",
      "predict": "...",
      "storage": "O(n f)"
    }
  }
}
```

Before an experiment, `ready` is `false` and `runs` is empty. The `theory` field provides theoretical cmplexity information.

Times are wall-clock measurements on the server. Memory usage is not measured, so `memoryBytes` is `null`.

## 4. Severity

Severity is disabled by default. Start the server with `--enable-severity` to include derived severity values in responses.

The current mapping in `include/severity.h` is:

| Attack type | Severity |
|---|---|
| DoS | High |
| BruteForce | Medium |
| PortScan | Low |
| Other | Medium |

Confidence below `0.6` lowers the severity by one level, with Low as the minimum.

Severity is derived from the predicted attack class and confidence. It is not a directly measured property of the network traffic.

## 5. Confidence

Confidence is calculated from the model output:

- **KNN:** the share of the nearest neighbours that voted for the predicted class.
- **Decision Tree:** the share of training rows belonging to the predicted class in the selected leaf.

With KNN `k = 1`, confidence is always `1.0`, because only one neighbour votes. Decision trees with pure leaves can also produce confidence values of `1.0`.

Use a larger KNN `k` if the demonstration needs more varied confidence values.

## 6. Current Limitations

- Trained models are retained in backend memory and are lost when the server restarts.
- Prediction requires a previously retained model.
- Only one background job can run at a time.
- Severity is disabled by default.
- Memory usage is not measured by complexity analysis; `memoryBytes` is `null`.
- Dataset preview requires a dataset to be loaded.
- Results from the training-and-detection workflow are based on the test split of the loaded dataset.
- The current backend does not provide a `/api/docs` endpoint.