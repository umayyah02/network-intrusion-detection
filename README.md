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
git clone https://github.com/<umayyah02>/<[network-intrusion-detection](https://github.com/umayyah02/network-intrusion-detection)>.git
cd <repository-name>
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

- `backend/include/data/` — dataset interfaces
- `backend/src/data/` — CSV loading and validation
- `backend/src/preprocessing/` — feature processing
- `docs/DATASET.md` — dataset and feature documentation

Responsible for CSV parsing, feature validation, missing values, preprocessing, labels, and preparing data for both models.

### Person 3 — Machine Learning Models

- `backend/include/models/` — shared model interfaces
- `backend/src/models/` — Decision Tree and KNN
- `backend/include/evaluation/` — evaluation interfaces
- `backend/src/evaluation/` — metrics implementation

Responsible for model training, predictions, model comparison, and evaluation metrics.

### Person 4 — Integration and Testing

- `backend/include/integration/` — integration interfaces, if needed
- `backend/src/integration/` — application integration, if needed
- `backend/tests/` — backend tests
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
