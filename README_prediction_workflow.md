# INIDS — Training and Prediction Workflow

## Overview

INIDS is a C++ network-flow intrusion detection project using K-Nearest Neighbors (KNN) and Decision Tree classifiers, with a React/TypeScript interface. It classifies network-flow records as `BENIGN`, `DoS`, `PortScan`, or `BruteForce`.

This update separates **training and held-out evaluation** from **prediction using an existing fitted model**. Previously, uploading a CSV could initiate a new 80/20 train/test split on that uploaded file, which was inappropriate for reproducing leave-one-attack-variant-out experiments.

## Workflows

### Mode 1 — Train & Evaluate

1. Select a training dataset, model, and hyperparameters.
2. Run the existing 80/20 training/test evaluation workflow (seed 42 in the reported configuration).
3. Retain the fitted model and its training-fitted preprocessing state in backend memory.
4. Display the baseline test metrics and training dataset metadata.

### Mode 2 — Predict Using Existing Model

1. Select an available retained model.
2. Select or upload an evaluation CSV.
3. Apply `prepareLike()` using the retained preprocessing configuration.
4. Predict on the uploaded records **without fitting the model or splitting the uploaded dataset**.
5. Report predictions and, when ground-truth labels are present, evaluation metrics.

The UI exposes the execution mode, `trainedOn`, and `evaluatedOn` so results are not mistaken for a different experiment.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/models` | List models retained in memory, including training dataset and baseline metadata |
| `POST` | `/api/predict` | Run prediction-only evaluation with a retained model |
| `POST` | `/api/evaluate` | Alias of prediction-only evaluation |
| `GET` | `/api/predict/status` | Check asynchronous prediction job status |
| `GET` | `/api/detect/status` | Existing detection/job status endpoint |

`POST /api/predict` supports multipart CSV uploads and JSON requests such as:

```json
{"model": "knn", "path": "held_DDoS.csv"}
```

The API returns `202 Accepted` for a started asynchronous job. The server must have a compatible retained model available before prediction can run. See the frontend's model selection for the available choices. Exact accepted paths and request fields should be checked against the deployed API implementation.

## Reproducing Experiments

### A2 unseen-DDoS variant

- Train on `A2_minus_DDoS.csv`, which excludes the DDoS variant being tested.
- For the reported KNN experiment, use Manhattan distance (`p=1`) and `K=1`.
- For the reported Decision Tree experiment, use unlimited depth and `minLeaf=2`.
- Predict on `held_DDoS.csv` without retraining.

Reported comparison against existing CLI output:

| Model | Correct DDoS classification | DDoS recall |
| --- | ---: | ---: |
| KNN | 30 / 200 | 15.0% |
| Decision Tree | 127 / 200 | 63.5% |

The supplied verification report states that the API matched `variant_results/knn_DDoS.txt` and `variant_results/tree_DDoS.txt` exactly. These figures describe correct **four-class** identification of DDoS, not necessarily binary attack detection.

### A3 baseline / external evaluation

- Train on `sample_A3.csv` with the matching model configuration.
- Evaluate `sample_B.csv` via prediction-only mode.

Reported API and CLI results: **97.60% accuracy (487/499)** for both KNN (`p=2`, `K=1`) and Decision Tree in this experiment.

**Important:** A3 contains DDoS training examples, so an A3-trained model cannot reproduce the *unseen-DDoS* experiment. Use the matching A2 variant-excluded training dataset for that purpose.

## Build

The backend command requires a compatible C++17 compiler; verify compiler support before building. From the repository root on Windows with MinGW available:

```powershell
g++ -O2 -std=c++17 -Iinclude -Ithird_party src/api/server.cpp src/api/app.cpp src/ml/decision_tree.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -lws2_32 -o inids_server.exe
npm.cmd --prefix gui run build
```

Run the API smoke test in a compatible shell/environment:

```bash
bash tests/api_smoke.sh
```

## Known Limitations and Verification Checklist

- **In-memory retention:** Models disappear after a backend restart; train again before using prediction mode.
- **Model replacement:** Verify whether training a second model of the same algorithm replaces the first. Confirm the selected model's `trainedOn` metadata.
- **Concurrent jobs:** Confirm that simultaneous training and prediction cannot corrupt retained state or mix job statuses.
- **Preprocessing:** Confirm feature order, transformations, and fitted parameters match between CLI and API. `prepareLike()` alone does not prove absence of all data leakage.
- **Result freshness:** Confirm consecutive uploads do not display stale predictions or previous-job metrics.
- **Input handling:** Validate CSV shape, file sizes, and permitted server-side paths; reject malformed requests cleanly.
- **Evaluation scope:** Strong results on known attack variants do not establish zero-day or unknown-variant detection.

### Suggested smoke tests

1. Train on A3, then predict on B and C without retraining.
2. Train on A2-minus-DDoS, then predict on held-DDoS; compare against CLI output.
3. Upload two different evaluation files consecutively and confirm model identity is unchanged.
4. Restart the server and confirm the UI handles an empty retained-model list.
5. Test missing/invalid CSV files and overlapping requests.
6. Run backend build, frontend build, and API smoke tests before merging.

## Files Changed in This Update

- `include/app.h` — retained model state and result metadata.
- `src/api/app.cpp` — model retention, prediction jobs, and preprocessing reuse.
- `src/api/server.cpp` — prediction and model-list endpoints.
- `gui/src/App.tsx` — explicit train/evaluate vs prediction UI.
- `tests/api_smoke.sh` — endpoint smoke tests.

This README documents the implementation and verification results **as reported by the project team**. Full regression testing and code review are still recommended before merge.
