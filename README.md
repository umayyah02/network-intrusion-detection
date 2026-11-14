# INIDS — Intelligent Network Intrusion Detection System

A machine-learning-based Network Intrusion Detection System that analyzes network traffic and classifies it as normal or malicious using Decision Tree and K-Nearest Neighbors (KNN).

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS |
| Backend | C++ |
| Machine Learning | Decision Tree, KNN |
| Dataset | CSV network traffic dataset |
| Build System | CMake (planned) |
| Version Control | Git, GitHub |
| Frontend–Backend Communication | HTTP REST API |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/umayyah02/network-intrusion-detection.git
cd network-intrusion-detection
```

### 2. Frontend setup

Requires Node.js and npm.

```bash
cd gui
npm ci
npm run dev
```

Opens at `http://localhost:5173`.

### 3. Backend setup

The backend is implemented in C++17. Its source files are located in `src/`, with header files in `include/`.

The backend build and run commands must be confirmed by the backend developer. The project currently has no `CMakeLists.txt`.

The API runs at `http://127.0.0.1:8080` by default.

---

## Machine Learning Models (KNN and Decision Tree)

Both classifiers are written from scratch in C++ (no external ML libraries). They read the scaled, feature-selected data produced by the preprocessing module (`prepareDataset` / `prepareLike`) and classify each network flow as `BENIGN`, `DoS`, `PortScan`, or `BruteForce`. Detailed documentation is also available in [`docs/MODELS.md`](docs/MODELS.md).

### Final configuration (A3, used by the demo and the API)

The final models are trained on `data/sample_A3.csv`. Settings were chosen by 5-fold stratified cross-validation inside the A3 training split only.

| Model | Final setting | Also the API default |
|---|---|---|
| KNN | **Euclidean distance (`p = 2`)**, `k = 1`, `distanceWeighted = false` | `p = 2.0`, `k = 1`, `distanceWeighted = false` |
| Decision Tree | Unlimited depth (`maxDepth = 0`), `minSamplesLeaf = 2` (depth 16, 161 nodes, 81 leaves) | `maxDepth = 0`, `minSamplesLeaf = 2` |

> **Note: A2 used a different KNN distance.** The earlier A2 study chose Manhattan distance (`p = 1`) by cross-validation on A2. Those results are kept in the generalization study below, labelled as A2. They are not the final configuration. To reproduce A2 through the API, send `{"model":"knn","params":{"k":1,"p":1,"distanceWeighted":false}}`.

**Why the tree uses `minSamplesLeaf = 2` when the CV table lists `minLeaf = 1` as best.** The A3 cross-validation scored `minLeaf = 1` at macro-F1 0.9767 and `minLeaf = 2` at 0.9721. The difference (0.0046) is inside the 0.005 margin that the tuning tool uses, and the tool's rule is to pick the simplest setting within that margin of the best. That setting is `minLeaf = 2` (also a lower CV false-alarm rate, 2.6% vs 3.0%). The rule was fixed in the tool before the A3 run, it was the same rule used for A2, and it was applied to CV results only. The test split and C were not used. The final run (`results_a3/a3_tree_final.txt`) and the API default both use `minSamplesLeaf = 2`. The full CV grid is in `results_a3/a3_tree_cv.txt`.

### Files

| File | Purpose |
|---|---|
| `include/knn.h` / `src/ml/knn.cpp` | K-Nearest Neighbours with Minkowski distance (p=1 Manhattan, p=2 Euclidean), plain or distance-weighted voting |
| `include/decision_tree.h` / `src/ml/decision_tree.cpp` | CART Decision Tree (Gini impurity), depth and leaf-size limits, feature importance, readable rules |
| `include/eval_utils.h` | Shared metrics, stratified k-fold cross-validation and report printing, used by both models so the comparison is fair |
| `tools/tune_knn.cpp` | Tuning and evaluation tool for KNN |
| `tools/tune_tree.cpp` | Tuning and evaluation tool for the Decision Tree |
| `knn_cv_results.csv` | Cross-validation grid search results for KNN across feature sets |
| `tree_cv_results.csv` | Cross-validation grid search results for Decision Tree across feature sets |
| `results/` | Output logs for all evaluated configurations on test splits and held-out files |
| `results_a3/` | Final A3 results: `a3_knn_cv.txt`, `a3_tree_cv.txt` (cross-validation) and `a3_knn_final.txt`, `a3_tree_final.txt` (test split and C) |

### How the Models Work

**KNN**
- **Distance:** Minkowski with $p=1$ (Manhattan) or $p=2$ (Euclidean). Squared Euclidean is used for ranking so no square root is needed. The final model uses $p=2$.
- **Voting:** Plain majority or distance-weighted ($1/d$). Ties are broken by the smaller summed distance, then the lower class index.
- **Search:** The $K$ nearest neighbours are found with `std::nth_element` ($O(N)$ average) rather than a full sort.
- **Confidence:** the number of the $K$ neighbours that voted for the winner, divided by $K$. With $K=1$ it is always 1.0.

**Decision Tree**
- **Splits:** Chosen by Gini impurity using a sorted sweep over each candidate feature split.
- **Stopping criteria:** `maxDepth` (0 = unlimited), `minSamplesLeaf`, `minSamplesSplit`, `minImpurityDecrease`.
- **Outputs:** Feature importance (weighted Gini decrease across splits) and readable textual rules (thresholds in scaled units).
- **Confidence:** the share of the predicted class among the training rows in the leaf.
- **Validation:** Checked against scikit-learn on the real sample: identical training accuracy, depth, node count, leaf count, and root split for six settings.

### Evaluation Method

1. Hyper-parameters are chosen by **5-fold stratified cross-validation inside the training split only**, ranked by macro-F1. When several settings are within about 0.005 to 0.01 macro-F1 of the best, the simpler one is preferred.
2. The held-out test split and the extra files (`C`, and for the A2 study `V` and `B`) are **never used for tuning**.
3. Each final configuration is run once and the results are reported as measured.

**Data files:**

| File | Content |
|---|---|
| `data/sample_A3.csv` | **Final training sample** (4,100 rows): BENIGN 2,000; PortScan 500; DoS 1,000 (Hulk, GoldenEye, slowloris, Slowhttptest, DDoS, 200 each); BruteForce 600 (FTP-Patator, SSH-Patator, web brute force, 200 each). After cleaning, 3,263 training and 816 test rows (80/20, seed 42). Shares no rows with A, B, C or V |
| `data/sample_C.csv` | Realistic mix, mostly benign (9,914 rows, 8,360 benign). Used for false alarms and alert precision |
| `data/sample_A2.csv` | Earlier training sample used for the generalization study (2,997 usable rows: 1,498 benign, 600 DoS, 449 PortScan, 450 BruteForce), split 80/20 with seed 42 |
| `data/sample_V.csv` | Attack variants held out of A2 training: slowloris, Slowhttptest, SSH-Patator, PortScan, benign (1,304 rows). **No longer a test of the final model**, because its variants are in A3 |
| `data/sample_B.csv` | New rows of attack types that are in training (499 rows). Near-copies of A2 rows, so **not** evidence of generalization |

### Results: final model (A3)

Feature set `all` (20 features). Test split and C were each run once. Raw outputs: `results_a3/a3_knn_final.txt` and `results_a3/a3_tree_final.txt`; CV tables: `results_a3/a3_knn_cv.txt` and `results_a3/a3_tree_cv.txt`.

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
| | Alert precision (flagged flows that are real attacks) | 87.6% | 89.0% |
| Speed, 9,914 rows | Prediction time | ~689 ms | ~0.27 ms |

### Generalization study (A2 and V): kept separate from the final model

These results use the **A2** training sample and the A2 settings (KNN Manhattan `p = 1`, `K = 1`, unweighted; tree unlimited depth, `minSamplesLeaf = 2`). They show how the models behave on attack variants they were never trained on. They are not the final A3 configuration.

| Test (trained on A2) | Metric | KNN (Manhattan, K=1) | Decision Tree |
|---|---|---|---|
| A2 held-out test (600 rows) | Accuracy | 98.3% | 97.2% |
| | False alarms on benign | 1.3% | 3.7% |
| C: realistic mix | Accuracy | 97.3% | 96.9% |
| | Macro-F1 | 0.857 | 0.831 |
| | False alarms on benign | 2.2% (185 of 8,360) | 2.7% (224 of 8,360) |
| | Detection rate (attack vs benign) | 95.8% | 95.9% |
| | Alert precision | 88.9% | 86.9% |
| V: unseen attack variants | Macro-F1 | 0.677 | 0.629 |
| | Slow DoS detected | 5.8% | 0.3% |
| | SSH brute force detected | 83.8% | 75.7% |
| Speed, 9,914 rows | Prediction time | ~506 ms | ~0.4 ms |

**Leave-one-variant-out (A2 minus one variant, then measure how much of that variant is flagged as any attack):**

| Held-out variant | KNN | Decision Tree |
|---|---|---|
| DoS Hulk | 75.5% | 57.0% |
| DoS GoldenEye | 1.5% | 72.5% |
| DDoS | 15.0% | 63.5% |
| FTP-Patator | 55.1% | 0% |
| Web brute force | 6.7% | 0% |
| Average | about 31% | about 39% |

In each of these runs the model still scored 97-99% on its own test split, so scores on familiar traffic are optimistic about new variants.

**Feature-set test (A2, same settings, only the features change):** removing the three TCP-setup features (`Init_Win_bytes_forward`, `Init_Win_bytes_backward`, `min_seg_size_forward`) did not improve detection of unseen variants (average 31% to 30% for KNN, 39% to 40% for the tree). Keeping only 5 or 10 features either gave no gain or raised false alarms (top-5 KNN: 13.1% false alarms on C). Training on all variants (A3) is what addresses the problem.

**Simple baselines on C (A2 training), for context:**

| Feature set | KNN false alarms | Tree false alarms | KNN alert precision | Tree alert precision |
|---|---|---|---|---|
| `all` | 2.2% | 2.7% | 88.9% | 86.9% |
| `portdur` | 11.8% | 12.7% | 59.3% | 57.8% |
| `portonly` | 15.8% | 15.9% | 52.6% | 52.6% |

`portdur` = Destination Port + Flow Duration; `portonly` = Destination Port only; `noport` = all features except Destination Port. These are baselines, not candidates.

### Key Findings

- On traffic similar to the training data, both models perform very well and give several times fewer false alarms than the simple port and duration baselines.
- KNN and the Decision Tree are close in accuracy. The Decision Tree is roughly 1,000 times faster (~0.3 ms vs ~689 ms on 9,914 rows) and can be interpreted as readable rules.
- **Models trained without a variant do not detect it reliably.** With A2, slow DoS (slowloris, Slowhttptest) looks like normal traffic and is almost completely missed, and leave-one-variant-out detection averages 31% to 39%. Training on all variants (A3) is the fix, but A3's test scores say nothing about attack types that are not in A3.
- On C the final A3 models still raise about 2 to 3% false alarms. Because C is mostly benign, alert precision is about 88 to 89%.

### Limitations

- The data contains many near-identical flows, so scores on familiar traffic are optimistic. This explains why $K=1$ and small `minSamplesLeaf` win in cross-validation.
- $K=1$ means KNN confidence is always 1.0. The tree's confidence is the class share in the leaf.
- Sample C is about 16% attacks. A real network has far fewer, so real-world alert precision would be lower.
- Sample C has only 51 BruteForce rows, so BruteForce precision (about 30 to 37% for the final models) is noisy.
- All figures come from sampled CICIDS2017 data, not live traffic.

### Build and Run

Compile the tuning and evaluation tools with C++17:

```bash
# Build KNN tuning tool
g++ -O2 -std=c++17 -Iinclude tools/tune_knn.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_knn

# Build Decision Tree tuning tool
g++ -O2 -std=c++17 -Iinclude tools/tune_tree.cpp src/ml/decision_tree.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_tree
```

**Final model (A3).** Tune with 5-fold cross-validation on the training sample (writes `knn_cv_results.csv` / `tree_cv_results.csv`), then run the final evaluation once:

```bash
./tune_knn  data/sample_A3.csv
./tune_tree data/sample_A3.csv

./tune_knn  data/sample_A3.csv final all 2 1 0 data/sample_C.csv
./tune_tree data/sample_A3.csv final all 0 2   data/sample_C.csv
```

**Generalization study (A2, `p = 1`):**

```bash
./tune_knn  data/sample_A2.csv final all 1 1 0 data/sample_V.csv data/sample_C.csv data/sample_B.csv
./tune_tree data/sample_A2.csv final all 0 2   data/sample_V.csv data/sample_C.csv data/sample_B.csv
```

*Arguments:*
- KNN: `final <set> <p> <K> <weighted> [other.csv ...]` (`p` = 1 Manhattan, 2 Euclidean)
- Tree: `final <set> <maxDepth> <minLeaf> [other.csv ...]`
- Feature sets: `all`, `noport`, `portdur`, `portonly` (the A2 study also used `notcp`, `top5`, `top10`).

### Using the Models in C++

```cpp
#include "knn.h"
#include "decision_tree.h"
#include "preprocessor.h"

// 1. Prepare data with preprocessing (final training sample)
PrepareOptions opt;
PreparedData p = prepareDataset("data/sample_A3.csv", opt);

// 2. KNN Classifier (final A3 configuration)
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

## Branch Rules

| Branch | Purpose |
|---|---|
| `main` | Stable version. Merges only through PRs. |
| `dev` | Integration branch for completed features. |
| `feat/frontend-*` | Person 1 — Frontend |
| `feat/data-*` | Person 2 — Dataset processing |
| `feat/models-*` | Person 3 — Decision Tree and KNN |
| `feat/testing-*` | Person 4 — Integration and testing |

**Rules:**
- Never push directly to `main`.
- Create a feature branch for every task.
- Merge completed features into `dev` through PRs.
- Test changes before opening a PR.
- Merge `dev` into `main` when the integrated version is stable.
- Coordinate before changing shared interfaces or files.

### Basic workflow

```bash
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

## What Each Person Owns

### Person 1 — Frontend

- `frontend/src/components/` — reusable UI components
- `frontend/src/pages/` — dashboard and results pages
- `frontend/src/services/` — backend communication
- `frontend/src/types/` — frontend data types
- `frontend/src/` — dashboard styling and UI integration

Responsible for dataset upload, model selection, dashboard, charts, results tab, and error/loading states.

### Person 2 — Dataset Processing

- `backend/include/data/` / `include/` — dataset interfaces
- `backend/src/data/` / `src/data/` — CSV loading and validation
- `backend/src/preprocessing/` — feature processing
- `docs/DATASET.md` — dataset and feature documentation

Responsible for CSV parsing, feature validation, missing values, preprocessing, labels, and preparing data for both models.

### Person 3 — Machine Learning Models

- `include/knn.h` / `src/ml/knn.cpp` — K-Nearest Neighbors classifier
- `include/decision_tree.h` / `src/ml/decision_tree.cpp` — CART Decision Tree classifier
- `include/eval_utils.h` — shared evaluation metrics and cross-validation
- `tools/tune_knn.cpp`, `tools/tune_tree.cpp` — model tuning and evaluation tools
- `docs/MODELS.md` — ML architecture, experiments, and results documentation

Responsible for model training, predictions, model comparison, and evaluation metrics.

### Person 4 — Integration and Testing

- `backend/include/integration/` — integration interfaces, if needed
- `backend/src/integration/` — application integration, if needed
- `backend/tests/` / `tests/` — backend tests
- `docs/API_CONTRACT.md` — frontend/backend contract
- `docs/TESTING.md` — testing instructions

Responsible for connecting the modules, testing predictions, verifying metrics, handling invalid inputs, and documenting complexity and performance.

**Folder structure is a proposed starting point.** Coordinate before creating or moving shared files. Every member should help with integration and the final report.

---

## Key Contracts

**Read these rules before implementing your module.**

1. **Dataset contract:** Both models must receive the same agreed feature representation. Required columns, label mapping, and preprocessing rules must be documented.
2. **Model contract:** Decision Tree and KNN must expose a consistent interface for training and prediction.
3. **Data leakage:** Fit preprocessing on training data only. Keep the held-out test set untouched until final evaluation.
4. **Prediction contract:** Every prediction must use the agreed label format, such as `Normal` or `Malicious`.
5. **Evaluation contract:** Compare both models using the same test set and agreed metrics: accuracy, precision, recall, F1-score, and confusion matrix.
6. **Frontend/backend contract:** Agree on the input format, model-selection field, prediction response, metrics, and error format before integration.
7. **Shared files:** Ask before changing model interfaces, shared types, feature names, or API contracts.
8. **Real results only:** The completed dashboard must display actual backend outputs, not hardcoded demonstration predictions.

---

## API / Integration Contract

The communication method is still to be finalized. If the team chooses an HTTP API, document the actual routes here once implemented.

| Operation | Purpose |
|---|---|
| Dataset submission | Provide a supported CSV dataset |
| Model selection | Select Decision Tree or KNN |
| Prediction | Return normal/malicious classifications |
| Evaluation | Return agreed metrics when evaluation labels are available |
| Health/status | Report backend availability and processing status |

The exact routes, request fields, response types, and error formats must be documented in `docs/API_CONTRACT.md`. Do not assume these operations already exist.

---

## Git Commit Rules

Use short, descriptive commit messages.

```text
feat: add dataset upload
feat: implement decision tree
feat: add knn predictions
fix: handle missing csv values
test: add model evaluation tests
docs: update setup instructions
refactor: separate preprocessing logic
```

Never commit passwords, API keys, generated build folders, or large datasets without team approval.

---

## Development Order

1. Finalize the dataset and feature/label definitions.
2. Set up the repository, folder structure, and build system.
3. Implement CSV loading and preprocessing.
4. Implement Decision Tree and KNN independently.
5. Build the React dashboard and results tab.
6. Finalize frontend/backend communication and integrate the modules.
7. Test both models, evaluate performance, and document time/space complexity.
8. Complete the report and presentation.

---

## Project Goal

Deliver a working C++-based network intrusion detection prototype with a React + TypeScript dashboard, independent Decision Tree and KNN classifiers, reliable evaluation, and clearly documented results.
