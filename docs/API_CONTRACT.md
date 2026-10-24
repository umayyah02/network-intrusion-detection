# API Contract (DRAFT)

Status: **draft for team review.** Nothing here is final until Member 2 (backend) and Member 3 (frontend) both agree. When a route is really implemented, change its status to **Implemented**.

Owner: Member 4 (Integration and Testing).

## 1. Basics

- Base URL (local development): `http://localhost:8080` (port to be agreed)
- Format: JSON in, JSON out (the CSV upload is `multipart/form-data`)
- Model names: `decision_tree` or `knn`
- Class names and order (same as `include/dataset.h`): `BENIGN` = 0, `DoS` = 1, `PortScan` = 2, `BruteForce` = 3
- Every prediction has `label` (one of the four class names) and `isMalicious` (`false` only for `BENIGN`).
- `confidence` is a number from 0 to 1. **The models do not output confidence yet** (they return only a class index), so until Member 2 adds it, `confidence` is `null`.
- The frontend must show real backend output only, never hardcoded predictions.

## 2. Routes

| Route | Purpose | Status |
|---|---|---|
| `GET /api/health` | Is the backend running? | Draft |
| `POST /api/dataset` | Upload a CSV dataset | Draft |
| `GET /api/dataset/summary` | Rows, columns, class counts | Draft |
| `POST /api/detect` | Start training and prediction with a chosen model | Draft |
| `GET /api/detect/status` | Progress of the running job | Draft |
| `GET /api/threats` | Detected threats (filters: `search`, `attackType`) | Draft |
| `GET /api/metrics` | Accuracy, precision, recall, F1, confusion matrix | Draft |
| `GET /api/complexity` | Timing results from the experiments | Draft |

## 3. Examples

### GET /api/health
```json
{ "status": "ok" }
```

### POST /api/dataset
Request: `multipart/form-data`, one field `file` (a `.csv`). Response `200`:
```json
{
  "rows": 2997,
  "columns": 20,
  "classCounts": { "BENIGN": 1498, "DoS": 600, "PortScan": 449, "BruteForce": 450 }
}
```

### GET /api/dataset/summary
Response `200`: same shape as the upload response.

### POST /api/detect
Request:
```json
{ "model": "decision_tree" }
```
Response `202`:
```json
{ "jobId": "abc123" }
```

### GET /api/detect/status
```json
{ "jobId": "abc123", "state": "running", "progress": 0.4 }
```
`state` is `idle`, `running`, `done`, or `failed`. When `failed`, an `error` object (section 4) is included.

### GET /api/threats
Optional query: `?search=...&attackType=DoS&page=1&pageSize=50`. Response `200`:
```json
{
  "total": 1,
  "items": [
    {
      "id": 1,
      "label": "DoS",
      "isMalicious": true,
      "confidence": null,
      "destinationPort": 80
    }
  ]
}
```
Source and destination IP, time and severity appear only if the data provides them. They are not in the current prepared data, so they are optional fields.

### GET /api/metrics
Query: `?model=decision_tree` (or `knn`). Matches the `Metrics` struct in `include/eval_utils.h`. Response `200`:
```json
{
  "model": "decision_tree",
  "accuracy": 0.98,
  "macroF1": 0.97,
  "falsePositiveRate": 0.01,
  "detectionRate": 0.99,
  "alertPrecision": 0.98,
  "classes": ["BENIGN", "DoS", "PortScan", "BruteForce"],
  "precision": [0.99, 0.98, 0.97, 0.96],
  "recall": [0.99, 0.98, 0.97, 0.96],
  "confusionMatrix": [[298, 1, 1, 0], [1, 118, 0, 1], [1, 0, 88, 1], [0, 1, 1, 88]]
}
```
The numbers above are an example only. `confusionMatrix[actual][predicted]` uses the order of `classes`.

### GET /api/complexity
```json
{ "results": [ { "model": "knn", "rows": 5000, "trainSeconds": 0.01, "predictSeconds": 3.2 } ] }
```

## 4. Error format

Every error uses one shape, with a matching HTTP status (`400` bad input, `404` not found, `409` wrong state, `500` server error):
```json
{ "error": { "code": "INVALID_CSV", "message": "Column 'Label' is missing." } }
```
Codes (draft): `INVALID_CSV`, `MISSING_COLUMN`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `UNKNOWN_MODEL`, `NO_DATASET_LOADED`, `JOB_ALREADY_RUNNING`, `INTERNAL_ERROR`.

## 5. Open decisions (team must settle)

1. Port and how the frontend reaches the backend (dev proxy or CORS).
2. Upload a CSV from the browser, or load a file path already on the machine?
3. Background job with status polling (above), or one request that waits?
4. Models need a way to output confidence (Member 2). Until then it is `null`.
5. If no HTTP library is allowed: replace the routes with JSON files the frontend loads (same shapes).
