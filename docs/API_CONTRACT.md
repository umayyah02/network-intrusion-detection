
# API Contract

**Version:** 1.0
**Status:** Implemented API reference

This document describes the HTTP API used by the INIDS frontend and C++ backend.

## 1. General Rules

- Default base URL: `http://127.0.0.1:8080`
- Data format: JSON, except CSV uploads, which use `multipart/form-data`.
- Detection, prediction, and complexity operations run as background jobs and return HTTP `202`.
- Trained models are retained in backend memory and are lost when the server restarts.

## 2. Model Classes

| Class | Label | Type |
|---|---:|---|
| BENIGN | 0 | Normal |
| DoS | 1 | Malicious |
| PortScan | 2 | Malicious |
| BruteForce | 3 | Malicious |

`BENIGN` is represented as `isMalicious: false`. The other three classes are represented as `isMalicious: true`.

## 3. Implemented Endpoints

### Health and dataset

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend health |
| GET | `/api/datasets` | List available datasets |
| GET | `/api/dataset/files` | List available dataset files |
| GET | `/api/dataset/summary` | Get the loaded dataset summary |
| GET | `/api/dataset/preview` | Preview loaded dataset rows |
| POST | `/api/dataset` | Load a dataset and return a compact response |
| POST | `/api/dataset/load` | Load a dataset and return its summary |

Dataset loading accepts a JSON body containing a `path`, or a multipart upload using the `file` field.

### Models and detection

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/models` | List supported models |
| POST | `/api/detect` | Start model training and detection |
| GET | `/api/detect/status` | Check detection job status |
| POST | `/api/predict` | Predict using a retained trained model |
| POST | `/api/evaluate` | Evaluate using the prediction workflow |
| GET | `/api/predict/status` | Check prediction job status |

Supported model names are `decision_tree` and `knn`.

Detection accepts a JSON body containing `model` and optional `params`.

Prediction and evaluation accept a dataset path or a multipart CSV upload. A retained trained model is required.

### Results and dashboard

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/detections` | Retrieve detection records |
| GET | `/api/detections/{id}` | Retrieve one detection record |
| GET | `/api/threats` | Retrieve malicious records |
| GET | `/api/threats/{id}` | Retrieve one threat record |
| GET | `/api/summary` | Retrieve detection summary |
| GET | `/api/metrics` | Retrieve evaluation metrics |
| GET | `/api/dashboard` | Retrieve dashboard data |

The detections endpoint returns all records by default. The threats endpoint returns 50 records by default. Both support page and page-size parameters.

### Complexity analysis

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/complexity/run` | Start complexity analysis |
| GET | `/api/complexity` | Retrieve complexity results |

Memory usage is not measured. The `memoryBytes` value is therefore `null`.

## 4. Job Status

Detection, prediction, and complexity operations run as background jobs.

The status response includes:

- `jobId`
- `type`
- `state`
- `stage`
- `model`
- `progress`
- `message`
- `startedAt`
- `finishedAt`
- `elapsedMs`
- `resultReady`

## 5. Errors

Errors use a JSON structure containing an error code and message.

Example:

```json
{
  "error": {
    "code": "INVALID_CSV",
    "message": "The uploaded CSV file is invalid."
  }
}
```

Common HTTP status codes include:

| Status | Meaning |
|---|---|
| 400 | Invalid request or input |
| 404 | Resource or endpoint not found |
| 409 | Operation conflicts with the current backend state |
| 500 | Internal server error |
| 202 | Background job accepted |

Examples of backend error codes include `INVALID_CSV`, `NO_DATASET`, `NO_MODEL`, `DATASET_LOADING`, and `JOB_RUNNING`.

## 6. Important Notes

- Detection trains the selected model on the loaded dataset.
- Prediction uses a previously retained model; it does not train a new model.
- Retained models are not saved to disk.
- Severity information is disabled by default and can be enabled with `--enable-severity`.
- Complexity analysis does not currently measure memory usage.
- This document describes implemented routes, not proposed future endpoints.
