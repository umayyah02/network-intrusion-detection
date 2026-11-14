# INIDS — Training and Prediction Workflow

## Overview

INIDS is a C++ network-flow intrusion detection project using K-Nearest Neighbors (KNN) and Decision Tree classifiers, with a React/TypeScript interface. It classifies network-flow records as `BENIGN`, `DoS`, `PortScan`, or `BruteForce`.

The API separates **training and held-out evaluation** from **prediction using an existing fitted model**. Earlier, uploading a CSV started a new 80/20 train/test split on the uploaded file. A file containing only one attack variant (for example `held_DDoS.csv`) was then partly used for training, which gave misleading results (100% accuracy) and made leave-one-variant-out experiments impossible to reproduce through the API.

## Workflows

### Mode 1 — Train & Evaluate

1. Select a training dataset, model, and hyperparameters.
2. Run the 80/20 training/test evaluation (seed 42 in the reported configuration).
3. Retain the fitted model and its training-fitted preprocessing state in backend memory.
4. Display the test-split metrics and the training dataset metadata.

### Mode 2 — Predict Using Existing Model

1. Select an available retained model.
2. Select or upload an evaluation CSV.
3. Apply `prepareLike()` using the retained preprocessing (training-fitted feature selection and scaling).
4. Predict on the uploaded records **without fitting the model or splitting the uploaded file**.
5. Report predictions and, when ground-truth labels are present, evaluation metrics.

The UI shows the execution mode, `trainedOn` and `evaluatedOn`, so a result cannot be mistaken for a different experiment.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/models` | List models retained in memory, with training dataset and baseline metadata |
| `POST` | `/api/predict` | Prediction-only evaluation with a retained model |
| `POST` | `/api/evaluate` | Alias of `/api/predict` |
| `GET` | `/api/predict/status` | Status of the asynchronous prediction job |
| `GET` | `/api/detect/status` | Status of the training/detection job |

`POST /api/predict` accepts a multipart CSV upload or a JSON request such as:

```json
{"model": "knn", "path": "held_DDoS.csv"}
```

A started job returns `202 Accepted`. A retained model must exist before prediction can run; the frontend's model list shows what is available. The route names above match `src/api/server.cpp`; the accepted request fields are defined in `src/api/app.cpp` and `docs/API_CONTRACT.md`.

## Reproducing Experiments

### A2 unseen-DDoS variant

- Train on `A2_minus_DDoS.csv`, which excludes the DDoS variant being tested.
- KNN: Manhattan distance (`p=1`), `K=1`, unweighted.
- Decision Tree: unlimited depth, `minLeaf=2`.
- Predict on `held_DDoS.csv` without retraining.

Result (API and CLI agree, see `variant_results/knn_DDoS.txt` and `variant_results/tree_DDoS.txt`):

| Model | DDoS rows labelled DoS | DDoS recall |
| --- | ---: | ---: |
| KNN | 30 / 200 | 15.0% |
| Decision Tree | 127 / 200 | 63.5% |

The rows not labelled DoS were predicted as BENIGN (KNN: 170 of 200), so here the share flagged as any attack equals the DoS recall.

### A3 baseline / external evaluation

- Train on `sample_A3.csv` with the A3 configuration (KNN `p=2`, `K=1`; tree unlimited depth, `minLeaf=2`).
- Evaluate `sample_B.csv` in prediction-only mode.

Result: **97.60% accuracy (487/499)** for both KNN and Decision Tree, from both the API and the CLI.

**Note:** A3 contains DDoS training examples, so an A3-trained model cannot reproduce the *unseen-DDoS* experiment. Use the matching A2 variant-excluded training file for that. Sample B is made of near-copies of A2 rows, so this result is not evidence of generalization.

## Build

The backend command requires a compatible C++17 compiler; verify compiler support before building. From the repository root on Windows with MinGW available:
Requires a C++17 compiler. From the repository root on Windows with MinGW:

```powershell
g++ -O2 -std=c++17 -D_WIN32_WINNT=0x0A00 -Iinclude -Ithird_party src/api/server.cpp src/api/app.cpp src/ml/decision_tree.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -pthread -lws2_32 -o inids_server.exe
npm.cmd --prefix gui run build
```

(`-D_WIN32_WINNT=0x0A00` and `-pthread` are needed by cpp-httplib and the background job thread on MinGW. On Linux, drop `-lws2_32` and the `_WIN32_WINNT` flag.)

API smoke test:

```bash
bash tests/api_smoke.sh
```

## Known Limitations

- **In-memory retention:** models are lost when the backend restarts. Train again before using prediction mode; the UI should show an empty model list in that case.
- **One job at a time:** training and prediction run as background jobs and share one job state.
- **Closed-set classifier:** results on known attack variants do not show detection of unknown attacks.
- **`prepareLike()`** applies the training-fitted preprocessing; it does not by itself rule out near-duplicate rows between a training and an evaluation file.

## Checks to run before merging

Record the outcome of each in the pull request.

1. Train on A3, then predict on B and C without retraining; confirm `trainedAt` does not change and the repeat run gives the same confusion matrix.
2. Train on A2-minus-DDoS, predict `held_DDoS.csv`, and compare with the CLI output above.
3. Upload two different evaluation files in a row and confirm the model identity (`trainedOn`) is unchanged and no result from the first file is shown for the second.
4. Train a second model of the same algorithm and note whether it replaces the first.
5. Restart the server and confirm the UI handles an empty model list.
6. Send a missing or malformed CSV and overlapping requests; confirm clean error responses.
7. Run the backend build, the frontend build and `tests/api_smoke.sh`.

## Files Changed in This Update

- `include/app.h` — retained model state and result metadata.
- `src/api/app.cpp` — model retention, prediction jobs, preprocessing reuse.
- `src/api/server.cpp` — prediction and model-list endpoints.
- `gui/src/App.tsx` — explicit Train & Evaluate versus Predict Using Existing Model UI.
- `tests/api_smoke.sh` — endpoint smoke tests.
