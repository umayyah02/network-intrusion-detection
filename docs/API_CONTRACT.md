
# API Contract

**Version:** 0.2
**Status:** Draft — for team review  
**Purpose:** Define communication between the INIDS frontend and backend.

## 1. General Rules

- Base URL: `http://localhost:8080` (to be confirmed by the backend developer).
- Data format: JSON, except CSV uploads, which use `multipart/form-data`.
- The frontend must display real backend results, not hardcoded demo predictions.
- If an endpoint needs to change or a new endpoint is required, notify the integration/testing member before changing the contract.

## 2. Model Classes

The backend uses these four classes:

| Class | Label |
|---|---:|
| BENIGN | 0 |
| DoS | 1 |
| PortScan | 2 |
| BruteForce | 3 |

For the dashboard, the proposed mapping is:
- `BENIGN` → normal (`isMalicious: false`)
- `DoS`, `PortScan`, `BruteForce` → malicious (`isMalicious: true`)

The backend and frontend developers must agree on this mapping.

## 3. API Endpoints

All endpoints below are proposed. The backend developer must confirm which ones are implemented.

### Required core endpoints

**GET `/api/health`**

Checks whether the backend is running.

Example response:
```json
{
  "status": "ok"
}
```

**GET `/api/datasets`**

Returns the available datasets.

Example response:
```json
{
  "datasets": [
    {
      "name": "sample.csv",
      "records": 3000,
      "features": 20,
      "status": "Loaded"
    }
  ]
}
```

**POST `/api/dataset`**

Uploads and loads a CSV dataset using `multipart/form-data`.

The response should report the dataset name, number of rows, number of columns, and any skipped rows.

**POST `/api/detect`**

Starts detection using the selected model.

Request:
```json
{
  "model": "decision_tree"
}
```

Allowed model names: `decision_tree`, `knn`.

If detection runs as a background job, return HTTP `202` with a `jobId`. The backend must then provide the status endpoint below. Otherwise, the backend developer should confirm the synchronous response format.

**GET `/api/detect/status`**

Optional if detection runs in the background. Returns the job ID, state (`idle`, `running`, `done`, or `failed`), progress, and an error message if it fails.

**GET `/api/detections`**

Returns prediction results for the frontend table. Support filtering by `all`, `threats`, or `normal` if required by the UI.

Each result should include:
- `id`
- `label`
- `isMalicious`

Only include additional fields when the dataset or backend actually provides them.

### Additional endpoints — confirm against the UI and project requirements

**GET `/api/summary`**

Returns total records, normal records, malicious records, and class counts if required by the dashboard.

**GET `/api/metrics`**

Returns evaluation metrics and the confusion matrix if required by the evaluation page. Metrics must come from actual model evaluation, not example values.

The confusion matrix must use the class order defined in Section 2, with rows representing actual classes and columns representing predicted classes.

**GET `/api/complexity`**

Returns measured training time, prediction time, and memory usage for performance analysis, if required by the project requirements. Do not invent measurements; use `null` when a value is unavailable.

## 4. Error Responses

Use a consistent error format:

```json
{
  "error": {
    "code": "INVALID_CSV",
    "message": "The uploaded CSV file is invalid."
  }
}
```

Use appropriate HTTP status codes:
- `400` — invalid input or CSV
- `404` — resource not found
- `409` — operation conflicts with the current state
- `500` — internal server error

The backend developer should document any additional error codes that are implemented.

## 5. Important Notes

- The API endpoints are a proposed interface, not proof that the endpoints already exist.
- Do not invent prediction confidence, severity, source IP, timestamps, or other unavailable data.
- The frontend should show `N/A` for unavailable display values, or omit those fields if they are not needed.
- The backend developer should notify the integration/testing member if more endpoints or different response fields are needed.
- The integration/testing member will update this contract after the team agrees on the final implementation.
