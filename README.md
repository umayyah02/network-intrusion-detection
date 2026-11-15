# ShieldNet (INIDS): ML-Powered Network Intrusion Detection System

A network intrusion detection prototype for the NED CT-159 Data Structures, Algorithms and Applications course. A C++17 backend cleans labelled CICIDS2017 flow records, trains two classifiers written from scratch (a CART Decision Tree and K-Nearest Neighbours), and exposes results through a local HTTP/JSON API. A React/TypeScript dashboard displays detections, threats, metrics and complexity measurements.

Each flow is classified as `BENIGN`, `DoS`, `PortScan` or `BruteForce`.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, TypeScript, Vite, CSS (`gui/`) |
| Backend and ML | C++17 (g++), standard library only for algorithms and containers |
| HTTP server and JSON | cpp-httplib, nlohmann/json (vendored in `third_party/`) |
| Frontend-backend communication | HTTP REST API (JSON) |
| Dataset | CICIDS2017 flow CSVs (sampled files in `data/`) |
| Build | Direct g++ commands (see below). CMake is not used. |
| Version control | Git, GitHub |

---

## Getting Started

### Prerequisites

- A C++17 compiler: g++ on Linux, or MinGW g++ on Windows
- Node.js and npm
- Git

```
git clone https://github.com/umayyah02/network-intrusion-detection.git
cd network-intrusion-detection
g++ --version
node --version
npm --version
```

The committed sample CSV files in `data/` are enough to run the demo. The full CICIDS2017 files are not committed.

### 1. Build the backend

Run from the repository root. The source tree is rooted at `src/`, with headers in `include/`.

**Windows (MinGW g++, PowerShell):**

```
g++ -O2 -std=c++17 -D_WIN32_WINNT=0x0A00 -Iinclude -Ithird_party src/api/server.cpp src/api/app.cpp src/ml/decision_tree.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -pthread -lws2_32 -o inids_server.exe
```

**Linux (g++):**

```
g++ -O2 -std=c++17 -Iinclude -Ithird_party src/api/server.cpp src/api/app.cpp src/ml/decision_tree.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -pthread -o inids_server
```

The Windows-specific `_WIN32_WINNT` define and `-lws2_32` flag are only needed on Windows.

### 2. Start the backend

Start from the repository root so the relative `data/` folder resolves. The API runs at `http://127.0.0.1:8080`.

**Windows:**

```
.\inids_server.exe --port 8080 --host 127.0.0.1 --data-dir data --dataset sample_A3.csv
```

**Linux:**

```
./inids_server --port 8080 --host 127.0.0.1 --data-dir data --dataset sample_A3.csv
```

`--dataset` preloads a CSV from the data directory. Omit it to load a dataset later from the dashboard. Keep this terminal open.

Health check (in another terminal):

```
curl http://127.0.0.1:8080/api/health
```

Expected: `{"status":"ok"}` (use `curl.exe` in Windows PowerShell).

### 3. Start the frontend

In a second terminal, from the repository root:

```
npm --prefix gui ci
npm --prefix gui run dev
```

On Windows PowerShell use `npm.cmd` instead of `npm`. The dashboard opens at `http://localhost:5173`. Keep both terminals running.

### 4. Use the dashboard

1. Load or select `sample_A3.csv`.
2. Choose KNN or Decision Tree and start training.
3. Inspect the summary cards, threats, metrics and complexity results.
4. Optionally use "predict with existing model" on another CSV such as `sample_C.csv`.

Trained models are kept in memory only and are lost when the backend restarts.

---

## API Routes

Implemented in `src/api/server.cpp`. If `docs/API_CONTRACT.md` disagrees, the source routes take precedence.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Backend status |
| GET | `/api/dataset/summary`, `/api/dataset/preview`, `/api/dataset/files`, `/api/datasets` | List and preview datasets |
| POST | `/api/dataset`, `/api/dataset/load` | Upload and load a dataset |
| GET | `/api/models` | List retained trained models |
| POST | `/api/detect` | Train and evaluate a model (background job) |
| POST | `/api/predict`, `/api/evaluate` | Predict with a retained model, without refitting |
| GET | `/api/detect/status`, `/api/predict/status` | Job status |
| GET | `/api/detections`, `/api/detections/{id}` | All test-row results |
| GET | `/api/threats`, `/api/threats/{id}` | Flagged (non-benign) rows |
| GET | `/api/summary`, `/api/metrics`, `/api/dashboard` | Aggregated results for the GUI |
| POST / GET | `/api/complexity/run`, `/api/complexity` | Run and read the complexity experiment |

Note: `POST /api/dataset` returns `skippedRows` as null because the cleaning report is not exposed by the data layer yet.

---

## Data Pipeline (preprocessing)

```
CSV -> load and validate -> clean -> split -> select features -> scale -> models
       csv_loader           cleaner   -------- preprocessor --------
```

1. **Load and validate** (`csv_loader`): each row must have the expected number of columns and strictly numeric, finite values. Bad rows are skipped and counted.
2. **Clean** (`cleaner`): labels are normalized and mapped to 4 classes, unknown labels are skipped, exact duplicates (same features and label) are removed with a `std::set`, and conflicting-feature rows are counted.
3. **Split** (`preprocessor`): stratified 80/20 split, seed 42, per class (Fisher-Yates shuffle on index arrays).
4. **Select features**: remove constant features, rank by Fisher score, skip features with absolute correlation above 0.95 to an already selected one, keep at most 20.
5. **Scale**: binary columns unchanged. Non-negative non-binary columns get log(1 + x) then z-score. Other columns get z-score only.

Steps 4 and 5 learn from training rows only, so the test set never leaks into preprocessing. `prepareDataset()` runs the full pipeline. `prepareLike()` applies the already fitted selection and scaling to another CSV without refitting. See `docs/DATASET.md` for details.

---

## Machine Learning Models (KNN and Decision Tree)

Both classifiers are written from scratch in C++ (no external ML libraries). They read the scaled, feature-selected data produced by the preprocessing module (`prepareDataset` / `prepareLike`). Detailed documentation is in `docs/MODELS.md`.

### Final configuration (A3, used by the demo and the API)

The final models are trained on `data/sample_A3.csv`. Settings were chosen by 5-fold stratified cross-validation inside the A3 training split only.

| Model | Final setting | Also the API default |
|---|---|---|
| KNN | Euclidean distance (p = 2), k = 1, distanceWeighted = false | p = 2.0, k = 1, distanceWeighted = false |
| Decision Tree | Unlimited depth (maxDepth = 0), minSamplesLeaf = 2 (depth 16, 161 nodes, 81 leaves) | maxDepth = 0, minSamplesLeaf = 2 |

Note: the earlier A2 study chose Manhattan distance (p = 1) by cross-validation on A2. Those results are kept in the generalization study below, labelled as A2. They are not the final configuration. To reproduce A2 through the API, send `{"model":"knn","params":{"k":1,"p":1,"distanceWeighted":false}}`.

**Why the tree uses minSamplesLeaf = 2 when the CV table lists minLeaf = 1 as best.** The A3 cross-validation scored minLeaf = 1 at macro-F1 0.9767 and minLeaf = 2 at 0.9721. The difference (0.0046) is inside the 0.005 margin that the tuning tool uses, and the tool's rule is to pick the simplest setting within that margin of the best. That setting is minLeaf = 2 (also a lower CV false-alarm rate, 2.6% vs 3.0%). The rule was fixed in the tool before the A3 run, it was the same rule used for A2, and it was applied to CV results only. The test split and C were not used. The full CV grid is in `results_a3/a3_tree_cv.txt`.

### Files

| File | Purpose |
|---|---|
| `include/knn.h` / `src/ml/knn.cpp` | KNN with Minkowski distance (p=1 Manhattan, p=2 Euclidean), plain or distance-weighted voting |
| `include/decision_tree.h` / `src/ml/decision_tree.cpp` | CART Decision Tree (Gini impurity), depth and leaf-size limits, feature importance, readable rules |
| `include/eval_utils.h` | Shared metrics, stratified k-fold cross-validation and report printing, used by both models |
| `tools/tune_knn.cpp`, `tools/tune_tree.cpp` | Tuning and evaluation tools |
| `tools/make_sample.cpp` | Builds the fixed-seed sample CSVs from the full CICIDS2017 files |
| `knn_cv_results.csv`, `tree_cv_results.csv` | Cross-validation grid search results |
| `results/` | Output logs for evaluated configurations |
| `results_a3/` | Final A3 results: `a3_knn_cv.txt`, `a3_tree_cv.txt`, `a3_knn_final.txt`, `a3_tree_final.txt` |

### How the models work

**KNN**

- Distance: Minkowski with p = 1 (Manhattan) or p = 2 (Euclidean). Squared Euclidean is used for ranking so no square root is needed. The final model uses p = 2.
- Voting: plain majority or distance-weighted (1/d). Ties are broken by the smaller summed distance, then the lower class index.
- Search: the K nearest neighbours are found with `std::nth_element` (O(N) average) rather than a full sort.
- Confidence: neighbours voting for the winner divided by K. With K = 1 it is always 1.0.

**Decision Tree**

- Splits are chosen by Gini impurity using a sorted sweep over each candidate feature.
- Stopping criteria: maxDepth (0 = unlimited), minSamplesLeaf, minSamplesSplit, minImpurityDecrease.
- Outputs: feature importance (weighted Gini decrease) and readable textual rules.
- Confidence: the share of the predicted class among the training rows in the leaf.
- Validation: checked against scikit-learn on the real sample (identical training accuracy, depth, node count, leaf count and root split for six settings).

### Evaluation method

1. Hyper-parameters are chosen by 5-fold stratified cross-validation inside the training split only, ranked by macro-F1. When several settings are within about 0.005 to 0.01 macro-F1 of the best, the simpler one is preferred.
2. The held-out test split and the extra files (C, and for the A2 study V and B) are never used for tuning.
3. Each final configuration is run once and the results are reported as measured.

### Data files

| File | Content |
|---|---|
| `data/sample_A3.csv` | Final training sample (4,100 rows): BENIGN 2,000; PortScan 500; DoS 1,000 (Hulk, GoldenEye, slowloris, Slowhttptest, DDoS, 200 each); BruteForce 600 (FTP-Patator, SSH-Patator, web brute force, 200 each). After cleaning: 3,263 training and 816 test rows (80/20, seed 42). Shares no rows with A, B, C or V. |
| `data/sample_C.csv` | Realistic mix, mostly benign (9,914 rows, 8,360 benign). Used for false alarms and alert precision. |
| `data/sample_A2.csv` | Earlier training sample for the generalization study (2,997 usable rows). |
| `data/sample_V.csv` | Attack variants held out of A2 training (1,304 rows). No longer a test of the final model, because its variants are in A3. |
| `data/sample_B.csv` | 499 near-copies of A2 rows. Not evidence of generalization. |
| `data/sample_1000.csv` | Initial small comparison sample. |

---

## Results: final model (A3)

Feature set `all` (20 features). The test split and C were each run once. Raw outputs: `results_a3/a3_knn_final.txt` and `results_a3/a3_tree_final.txt`.

| Test | Metric | KNN (Euclidean, K=1) | Decision Tree |
|---|---|---|---|
| CV on A3 training split | Macro-F1 | 0.972 | 0.972 |
| A3 held-out test (816 rows) | Accuracy | 97.6% | 97.6% |
| | Macro-F1 | 0.975 | 0.976 |
| | False alarms on benign | 2.8% (11 of 400) | 2.3% (9 of 400) |
| | Alert precision | 97.4% | 97.8% |
| C: realistic mix | Accuracy | 97.5% | 97.4% |
| | Macro-F1 | 0.841 | 0.854 |
| | False alarms on benign | 2.6% (215 of 8,360) | 2.2% (183 of 8,360) |
| | Detection rate (attack vs benign) | 97.7% | 95.6% |
| | Alert precision | 87.6% | 89.0% |
| Speed, 9,914 rows | Prediction time | ~689 ms | ~0.27 ms |

Metric definitions:

- **Detection rate (recall):** of all real attacks, how many were flagged as an attack.
- **Alert precision:** of all flows flagged as an attack, how many were real attacks.
- **False alarm rate:** of all benign flows, how many were wrongly flagged as an attack.

---

## Generalization study (A2 and V): kept separate from the final model

These results use the A2 training sample and A2 settings (KNN Manhattan p = 1, K = 1, unweighted; tree unlimited depth, minSamplesLeaf = 2). They show how the models behave on attack variants they were never trained on. They are not the final A3 configuration.

| Test (trained on A2) | Metric | KNN (Manhattan, K=1) | Decision Tree |
|---|---|---|---|
| A2 held-out test (600 rows) | Accuracy | 98.3% | 97.2% |
| | False alarms on benign | 1.3% | 3.7% |
| C: realistic mix | Accuracy | 97.3% | 96.9% |
| | Macro-F1 | 0.857 | 0.831 |
| | False alarms on benign | 2.2% (185 of 8,360) | 2.7% (224 of 8,360) |
| | Detection rate | 95.8% | 95.9% |
| | Alert precision | 88.9% | 86.9% |
| V: unseen attack variants | Macro-F1 | 0.677 | 0.629 |
| | Slow DoS detected | 5.8% | 0.3% |
| | SSH brute force detected | 83.8% | 75.7% |
| Speed, 9,914 rows | Prediction time | ~506 ms | ~0.4 ms |

Leave-one-variant-out (A2 minus one variant, then measure how much of that variant is flagged as any attack):

| Held-out variant | KNN | Decision Tree |
|---|---|---|
| DoS Hulk | 75.5% | 57.0% |
| DoS GoldenEye | 1.5% | 72.5% |
| DDoS | 15.0% | 63.5% |
| FTP-Patator | 55.1% | 0% |
| Web brute force | 6.7% | 0% |
| Average | about 31% | about 39% |

In each of these runs the model still scored 97-99% on its own test split, so scores on familiar traffic are optimistic about new variants.

---

## Key Findings

- On traffic similar to the training data, both models perform very well.
- KNN and the Decision Tree are close in accuracy. The Decision Tree is roughly 2,500 times faster in the logged Sample C run (~0.27 ms vs ~689 ms on 9,914 rows) and can be read as rules. This ratio belongs to that run and machine.
- Neither model dominates: the tree has fewer false alarms and higher alert precision, while KNN has a higher attack detection rate on C.
- Models trained without a variant do not detect it reliably (A2/V study). Training on all variants (A3) addresses this, but A3's test scores say nothing about attack types that are not in A3.
- On C the final models still raise about 2 to 3% false alarms. Because C is mostly benign, alert precision is about 88 to 89%.

## Limitations

- The data contains many near-identical flows, so scores on familiar traffic are optimistic. This explains why K = 1 and small minSamplesLeaf win in cross-validation.
- With K = 1, KNN confidence is always 1.0 and is not a calibrated probability.
- Sample C is about 84% benign. A real network has far fewer attacks, so real-world alert precision would be lower.
- Sample C has only 51 BruteForce rows, so BruteForce precision is noisy.
- Both models are closed-set: they always output one of four known labels.
- All figures come from sampled offline CICIDS2017 data, not live traffic. No packet capture is demonstrated.
- Models are held in memory and are lost when the backend restarts.

---

## Reproduce the Results and Run Tests

### Tuning and evaluation tools

```
# Build
g++ -O2 -std=c++17 -Iinclude tools/tune_knn.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_knn
g++ -O2 -std=c++17 -Iinclude tools/tune_tree.cpp src/ml/decision_tree.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_tree

# Final model (A3): cross-validation, then one final evaluation
./tune_knn  data/sample_A3.csv
./tune_tree data/sample_A3.csv
./tune_knn  data/sample_A3.csv final all 2 1 0 data/sample_C.csv
./tune_tree data/sample_A3.csv final all 0 2   data/sample_C.csv

# Generalization study (A2, p = 1)
./tune_knn  data/sample_A2.csv final all 1 1 0 data/sample_V.csv data/sample_C.csv data/sample_B.csv
./tune_tree data/sample_A2.csv final all 0 2   data/sample_V.csv data/sample_C.csv data/sample_B.csv
```

On Windows add `.exe` to the output names and run with `.\tune_knn.exe` and `.\tune_tree.exe`.

Arguments:

- KNN: `final <set> <p> <K> <weighted> [other.csv ...]` (p = 1 Manhattan, 2 Euclidean)
- Tree: `final <set> <maxDepth> <minLeaf> [other.csv ...]`
- Feature sets: `all`, `noport`, `portdur`, `portonly` (the A2 study also used `notcp`, `top5`, `top10`).

### C++ tests

```
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testdata.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_data
./test_data
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testmodels.cpp src/ml/knn.cpp src/ml/decision_tree.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_models
./test_models
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testpipeline.cpp src/ml/knn.cpp src/ml/decision_tree.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_pipeline
./test_pipeline
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testbadinput.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_badinput
./test_badinput
```

Each program prints a success message ("All data-layer tests passed", "All model and metrics tests passed", "All pipeline tests passed", "All bad-input tests passed"). See `docs/TESTING.md` (marked draft).

### API smoke test

Start the backend without a preloaded dataset, then from another terminal (bash and curl required; Git Bash works on Windows):

```
bash tests/api_smoke.sh sample_A2.csv
```

---

## Using the Models in C++

```cpp
#include "knn.h"
#include "decision_tree.h"
#include "preprocessor.h"

// 1. Prepare data with preprocessing (final training sample)
PrepareOptions opt;
PreparedData p = prepareDataset("data/sample_A3.csv", opt);

// 2. KNN classifier (final A3 configuration)
KnnOptions ko;
ko.k = 1;
ko.p = 2.0;             // Euclidean (A2 study used 1.0 = Manhattan)
ko.distanceWeighted = false;
KNN knn(ko);
knn.fit(p.train);
auto knnLabels = knn.predictAll(p.test.X);

// 3. CART Decision Tree
TreeOptions to;
to.maxDepth = 0;        // unlimited depth
to.minSamplesLeaf = 2;
DecisionTree tree(to);
tree.fit(p.train);
auto treeLabels = tree.predictAll(p.test.X);
```

Other CSV files are prepared with the training statistics through `prepareLike(p, path, nullptr)` so they are scaled the same way as the training data.

---

## Repository Layout

| Folder | Contents |
|---|---|
| `src/api/` | HTTP server and application logic (`server.cpp`, `app.cpp`) |
| `src/data/` | CSV loading, cleaning, dataset container, preprocessing |
| `src/ml/` | KNN and Decision Tree |
| `include/` | Headers (`cleaner.h`, `csv_loader.h`, `dataset.h`, `preprocessor.h`, `record.h`, `knn.h`, `decision_tree.h`, `eval_utils.h`) |
| `gui/` | React/TypeScript dashboard (Vite) |
| `tools/` | Sampling, tuning and evaluation tools |
| `tests/` | C++ test programs and the API smoke script |
| `data/` | Sample CSV files |
| `docs/` | `DATASET.md`, `MODELS.md`, `API_CONTRACT.md` (draft), `TESTING.md` (draft) |
| `results/`, `results_a3/` | Experiment logs |
| `third_party/` | Vendored cpp-httplib and nlohmann/json |

---

## Team Roles

| Role | Responsibility | Main areas |
|---|---|---|
| Frontend | Dashboard, dataset upload, model selection, charts, results, error and loading states | `gui/` |
| Dataset processing | CSV parsing, validation, cleaning, labels, preprocessing, sampling | `src/data/`, `include/` (data headers), `tools/make_sample.cpp`, `docs/DATASET.md` |
| Machine learning | KNN, Decision Tree, evaluation metrics, tuning | `src/ml/`, `include/knn.h`, `include/decision_tree.h`, `include/eval_utils.h`, `tools/tune_*.cpp`, `docs/MODELS.md` |
| Integration and testing | API, connecting modules, tests, complexity experiment | `src/api/`, `tests/`, `docs/API_CONTRACT.md`, `docs/TESTING.md` |

---

## Branch Rules

| Branch | Purpose |
|---|---|
| `main` | Stable version. Merges only through PRs. |
| `dev` | Integration branch for completed features. |
| `feat/frontend-*` | Frontend |
| `feat/data-*` | Dataset processing |
| `feat/models-*` | Decision Tree and KNN |
| `feat/testing-*` | Integration and testing |

Rules:

- Never push directly to `main`.
- Create a feature branch for every task.
- Merge completed features into `dev` through PRs.
- Test changes before opening a PR.
- Merge `dev` into `main` when the integrated version is stable.
- Coordinate before changing shared interfaces or files.

```
git switch dev
git pull origin dev
git switch -c feat/your-task

# Make and test your changes
git add .
git commit -m "feat: describe your changes"
git push -u origin feat/your-task
```

Open a PR targeting `dev` and request a teammate's review.

---

## Key Contracts

1. **Dataset contract:** both models receive the same feature representation (20 selected features, scaled).
2. **Model contract:** Decision Tree and KNN expose a consistent `fit` / `predictAll` interface.
3. **Data leakage:** preprocessing is fitted on training data only. The held-out test set stays untouched until final evaluation.
4. **Evaluation contract:** both models are compared on the same test set with the same metrics (accuracy, precision, recall, F1, confusion matrix, false alarm rate).
5. **Shared files:** ask before changing model interfaces, shared types, feature names or API routes.
6. **Real results only:** the dashboard displays actual backend outputs, not hardcoded predictions.

## Git Commit Rules

Use short, descriptive commit messages:

```
feat: add dataset upload
fix: handle missing csv values
test: add model evaluation tests
docs: update setup instructions
refactor: separate preprocessing logic
```

Never commit passwords, API keys, generated build folders or large datasets without team approval.

## Project Goal

Deliver a working C++ network intrusion detection prototype with a React + TypeScript dashboard, independent Decision Tree and KNN classifiers, reliable evaluation and clearly documented results.
