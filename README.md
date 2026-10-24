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
| Frontend–Backend Communication | To be finalized |

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
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### 3. Backend setup

Requires a C++17-compatible compiler. CMake is planned as the build system.

Check your compiler:

```bash
g++ --version
```

Once the backend build configuration is added:

```bash
cd backend
cmake -S . -B build
cmake --build build
```

**Note:** These backend commands require a valid `CMakeLists.txt` and the agreed dependencies to be in place. The team must document the final run command and any required libraries before backend setup is considered complete.

---

## Machine Learning Models (KNN and Decision Tree)

Both classifiers are written from scratch in C++ (no external ML libraries). They read the scaled, feature-selected data produced by the preprocessing module (`prepareDataset` / `prepareLike`) and classify each network flow as `BENIGN`, `DoS`, `PortScan`, or `BruteForce`. Detailed documentation is also available in [`docs/MODELS.md`](docs/MODELS.md).

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

### How the Models Work

**KNN**
- **Distance:** Minkowski with $p=1$ (Manhattan) or $p=2$ (Euclidean). Squared Euclidean is used for ranking so no square root is needed.
- **Voting:** Plain majority or distance-weighted ($1/d$). Ties are broken by the smaller summed distance, then the lower class index.
- **Search:** The $K$ nearest neighbours are found with `std::nth_element` ($O(N)$ average) rather than a full sort.

**Decision Tree**
- **Splits:** Chosen by Gini impurity using a sorted sweep over each candidate feature split.
- **Stopping criteria:** `maxDepth` (0 = unlimited), `minSamplesLeaf`, `minSamplesSplit`, `minImpurityDecrease`.
- **Outputs:** Feature importance (weighted Gini decrease across splits) and readable textual rules (thresholds in scaled units).
- **Validation:** Checked against scikit-learn on the real sample: identical training accuracy, depth, node count, leaf count, and root split for six settings.

### Evaluation Method

1. Hyper-parameters are chosen by **5-fold stratified cross-validation inside the training split only**, ranked by macro-F1.
2. The held-out test split, and the extra files `V`, `C`, and `B`, are **never used for tuning**.
3. Each final configuration is run once and the results are reported as measured.

**Feature sets compared:**

| Set | Features |
|---|---|
| `all` | The 20 features selected by the preprocessor |
| `noport` | Same as `all` with Destination Port removed |
| `portdur` | Destination Port + Flow Duration (simple baseline) |
| `portonly` | Destination Port only (simple baseline) |

**Data files:**

| File | Content |
|---|---|
| `data/sample_A2.csv` | Training sample (2,997 usable rows: 1,498 benign, 600 DoS, 449 PortScan, 450 BruteForce), split 80/20 with seed 42 |
| `data/sample_V.csv` | Attack variants held out of training: slowloris, Slowhttptest, SSH-Patator, PortScan, benign (1,304 rows) |
| `data/sample_C.csv` | Realistic mix, mostly benign (9,914 rows, 8,360 benign) |
| `data/sample_B.csv` | New rows of attack types that are in training (499 rows). Near-copies of A2 rows, so **not** evidence of generalization |

### Chosen Settings

| Model | Setting (chosen by cross-validation) |
|---|---|
| KNN | Manhattan distance ($p=1$), $K=1$, unweighted |
| Decision Tree | Unlimited depth (`maxDepth=0`), `minSamplesLeaf=2` (55 leaves, depth 13) |

### Results (feature set `all`)

| Test | Metric | KNN | Decision Tree |
|---|---|---|---|
| A2 held-out test (600 rows) | Accuracy | 98.3% | 97.2% |
| | False alarms on benign | 1.3% | 3.7% |
| C: realistic mix | Accuracy | 97.3% | 96.9% |
| | Macro-F1 | 0.857 | 0.831 |
| | False alarms on benign | 2.2% (185 of 8,360) | 2.7% (224 of 8,360) |
| | Detection rate (attack vs benign) | 95.8% | 95.9% |
| | Alert precision (flagged flows that are real attacks) | 88.9% | 86.9% |
| V: unseen attack variants | Macro-F1 | 0.677 | 0.629 |
| | Slow DoS detected | 5.8% | 0.3% |
| | SSH brute force detected | 83.8% | 75.7% |
| Speed, 9,914 rows | Prediction time | ~506 ms | ~0.4 ms |

**Simple baselines on C, for context:**

| Feature set | KNN false alarms | Tree false alarms | KNN alert precision | Tree alert precision |
|---|---|---|---|---|
| `all` | 2.2% | 2.7% | 88.9% | 86.9% |
| `portdur` | 11.8% | 12.7% | 59.3% | 57.8% |
| `portonly` | 15.8% | 15.9% | 52.6% | 52.6% |

### Key Findings

- On traffic similar to the training data, both models perform very well and give 4 to 7 times fewer false alarms than the simple port and duration baselines.
- KNN and the Decision Tree are close in accuracy. KNN has slightly fewer false alarms. The Decision Tree is roughly 1,000 times faster (~0.4 ms vs ~506 ms) and can be interpreted as readable rules.
- **Neither model generalizes to attack types it has not seen.** Slow DoS (slowloris, Slowhttptest) looks like normal traffic to them and is almost completely missed. The simple port+duration model catches about 88% of it, but at about 12% false alarms.
- Training on the first sample alone gave only 65% (KNN) and 78% (tree) accuracy on DDoS and web brute force files. Adding those types to training resolved this because they became known types.

### Limitations

- The data contains many near-identical flows, so scores on familiar traffic are optimistic. This explains why $K=1$ and small `minSamplesLeaf` win in cross-validation.
- Sample C is about 16% attacks. A real network has far fewer, so real-world alert precision would be lower.
- Sample C has only 51 BruteForce rows, so BruteForce precision (about 31 to 39%) is noisy.
- All figures come from sampled CICIDS2017 data, not live traffic.

### Build and Run

Compile the tuning and evaluation tools with C++17:

```bash
# Build KNN tuning tool
g++ -O2 -std=c++17 -Iinclude tools/tune_knn.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_knn

# Build Decision Tree tuning tool
g++ -O2 -std=c++17 -Iinclude tools/tune_tree.cpp src/ml/decision_tree.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_tree
```

Tune with 5-fold cross-validation on the training sample (writes `knn_cv_results.csv` / `tree_cv_results.csv`):

```bash
./tune_knn data/sample_A2.csv
./tune_tree data/sample_A2.csv
```

Run final evaluation with the chosen settings and held-out test files:

```bash
./tune_knn  data/sample_A2.csv final all 1 1 0 data/sample_V.csv data/sample_C.csv data/sample_B.csv
./tune_tree data/sample_A2.csv final all 0 2   data/sample_V.csv data/sample_C.csv data/sample_B.csv
```

*Arguments:*
- KNN: `final <set> <p> <K> <weighted> [other.csv ...]`
- Tree: `final <set> <maxDepth> <minLeaf> [other.csv ...]`
- Feature sets: `all`, `noport`, `portdur`, `portonly`.

### Using the Models in C++

```cpp
#include "knn.h"
#include "decision_tree.h"
#include "preprocessor.h"

// 1. Prepare data with preprocessing
PrepareOptions opt;
PreparedData p = prepareDataset("data/sample_A2.csv", opt);

// 2. KNN Classifier
KnnOptions ko;
ko.k = 1;
ko.p = 1.0;
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
