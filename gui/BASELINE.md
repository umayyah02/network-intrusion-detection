# INIDS GUI baseline (M0)

Source: `gui/src/App.tsx` (single file, about 2,370 lines), checked against `origin/main` (commit 15cfc2a) on 14 Nov 2026. Snapshot only, no code changed.
API base: `import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080'`. All calls use raw `fetch`.

## App shell (`App`)
- Page state is `useState<Page>('Dashboard')`; no URL sync, so refresh returns to Dashboard.
- Six pages: Dashboard, Dataset, Detection, Threats, Results & Evaluation, Complexity Analysis (unicode glyph icons).
- Fixed sidebar (md+), slide-in drawer with backdrop on mobile, hamburger button in the top bar.
- Sidebar footer card and top-bar chip ("C++ Backend API") are static and not health-driven; avatar "M3" is static.
- Helpers: `MetricCard`, `PageHeading`. Footer line on every page.

## Dashboard
- Features: 4 metric cards (records analyzed, threats detected, normal traffic, model accuracy %); attack-type distribution as CSS bars (share of threats); dataset and model line; "Detection completed at ... (UTC)".
- States: loading text, error text, empty text ("No dashboard results available.").
- API: `GET /api/dashboard`

## Dataset
- Features: search box filtering dataset list; select a dataset; "Load Selected Dataset" with status message; cards for available datasets count and loaded dataset name; summary cards when loaded (total/train/test rows, per-class counts, feature count); CSV preview table (20 rows, scrollable, sticky header) with its own loading/error state.
- No dataset upload exists on this page (the only upload is the evaluation CSV on Detection).
- Preview and summary auto-load on mount and refresh after a load.
- API:
  - `GET /api/datasets`
  - `POST /api/dataset` (JSON `{ path }`)
  - `GET /api/dataset/summary`
  - `GET /api/dataset/preview?limit=20`

## Detection
- Workflow tabs: **Mode 1: Train & Evaluate (80/20 Split)** and **Mode 2: Predict Using Existing Model (Zero Retraining)**.
- Train: model picker (Decision Tree / KNN); KNN distance (euclidean p=2, manhattan p=1; k fixed at 1); run button disabled while running or with no loaded dataset.
- Predict: picks a retained trained model (hint to train first if none); evaluation source is a server file (defaults to a path containing `held_DDoS`, else the first) or an uploaded custom CSV (shows name and KB).
- Job progress: progress value and message, polled every 500 ms until `done` or `failed`; on done it refetches detections and models.
- Results (shown only when detections exist): a banner (evaluated dataset, model trained on, execution-mode badge), a heading line with the model name and record count, and a classification table limited to the first 20 rows (predicted class, confidence, actual, correct).
- API:
  - `GET /api/models`
  - `GET /api/dataset/files`
  - `GET /api/datasets` (finds the loaded dataset)
  - `POST /api/detect` (JSON `{ model, params? }`)
  - `GET /api/detect/status` (poll)
  - `GET /api/detections`
  - `POST /api/predict` (JSON `{ model, path }`, or multipart `file` + `model`)

## Threats
- Features: malicious-only detections; search by record ID or attack type; attack-type select; pagination at 20 per page with range text and prev/next; severity column; row click opens a detail panel (predicted attack, severity, confidence, actual class, correct yes/no, class index, malicious flag) with close button.
- Note kept in UI: source IP and timestamp are not provided by the backend.
- API: `GET /api/detections` (filters `isMalicious` on the client)

## Results & Evaluation
- Features: side-by-side Decision Tree and KNN cards; accuracy, macro precision, macro recall, F1; mode badge (predict vs train); confusion matrix as a table; "No results available. Run this model from Detection." when a model has no report.
- API: `GET /api/metrics`

## Complexity Analysis
- Features: model toggle (Decision Tree / KNN); metric toggle (predict ms / train ms); Recharts scalability chart over train rows with tooltip; time and space complexity cards; "Refresh benchmarks" and "Run new benchmark" buttons; "not ready yet" message when `ready` is false.
- Run does not poll; the user clicks Refresh after it finishes.
- API:
  - `GET /api/complexity`
  - `POST /api/complexity/run` (JSON `{}`)

## All endpoints (method + path)
| Method | Path |
|---|---|
| GET | /api/dashboard |
| GET | /api/datasets |
| POST | /api/dataset |
| GET | /api/dataset/summary |
| GET | /api/dataset/preview?limit=20 |
| GET | /api/dataset/files |
| GET | /api/models |
| POST | /api/detect |
| GET | /api/detect/status |
| GET | /api/detections |
| POST | /api/predict |
| GET | /api/metrics |
| GET | /api/complexity |
| POST | /api/complexity/run |

## Lint and build status at baseline
- `npm run lint`: 0 errors, 2 `react-hooks/exhaustive-deps` warnings in `DetectionPage` (`fetchServerFiles`, `checkDetectionStatus`).
- `npm run build`: passes; one chunk-size warning (about 620 kB, Recharts).

## Notes for later milestones
- Behavior to preserve: KNN `k=1` and `p` mapping, 500 ms polling, 20-row detection list, 20-per-page threats, the `held_DDoS` default file, the UTC finish time.
- PRD FR-12 mentions a dataset "upload flow"; the current code has none on Dataset. Treat the Detection CSV upload as the only upload.
- The Detection page swallows errors from `/api/models`, `/api/dataset/files` and `/api/datasets` silently (`catch {}`).