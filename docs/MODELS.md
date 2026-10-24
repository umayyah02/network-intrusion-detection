# Machine Learning Models (KNN and Decision Tree)

Owner: Aun Haider (Member 2, ML layer)  
Project: Intelligent Network Intrusion Detection and Threat Analysis System  

Both classifiers are written from scratch in C++ (no external ML libraries). They read the scaled, feature-selected data produced by the preprocessing module (`prepareDataset` / `prepareLike`) and classify each network flow as `BENIGN`, `DoS`, `PortScan` or `BruteForce`.

---

## 1. Files and Organization

| File | Purpose |
|---|---|
| `include/knn.h` / `src/ml/knn.cpp` | K-Nearest Neighbours with Minkowski distance (p=1 Manhattan, p=2 Euclidean), plain or distance-weighted voting |
| `include/decision_tree.h` / `src/ml/decision_tree.cpp` | CART Decision Tree (Gini impurity), depth and leaf-size limits, feature importance, readable rules |
| `include/eval_utils.h` | Shared metrics, stratified k-fold cross-validation and report printing, used by both models so the comparison is fair |
| `tools/tune_knn.cpp` | Tuning and evaluation tool for KNN |
| `tools/tune_tree.cpp` | Tuning and evaluation tool for the Decision Tree |
| `knn_cv_results.csv` | Cross-validation grid search results for KNN across feature sets |
| `tree_cv_results.csv` | Cross-validation grid search results for Decision Tree across feature sets |
| `results/` | Terminal output logs for all evaluated configurations on test splits and held-out files |

---

## 2. How the Models Work

### KNN
- **Distance**: Minkowski with $p=1$ (Manhattan) or $p=2$ (Euclidean). Squared Euclidean is used for ranking so no square root is needed during neighbor lookup.
- **Voting**: Plain majority or inverse distance-weighted ($1 / d$). Ties are broken by the smaller summed distance, then the lower class index.
- **Search**: The $K$ nearest neighbours are found with `std::nth_element` ($O(N)$ average time per query) rather than a full $O(N \log N)$ sort.

### Decision Tree
- **Splits**: Chosen by Gini impurity using a sorted sweep over each candidate feature split.
- **Stopping Criteria**: `maxDepth` (0 = unlimited), `minSamplesLeaf`, `minSamplesSplit`, `minImpurityDecrease`.
- **Outputs**: Feature importance (weighted Gini decrease across splits) and readable textual rules (thresholds in scaled units).
- **Validation**: Checked against scikit-learn on the real sample: identical training accuracy, depth, node count, leaf count, and root split for six settings.

---

## 3. Evaluation Method

1. Hyper-parameters are chosen by **5-fold stratified cross-validation inside the training split only**, ranked by macro-F1.
2. The held-out test split, and the extra files `V`, `C` and `B`, are **never used for tuning**.
3. Each final configuration is run once and the results are reported as measured.

### Feature sets compared:

| Set | Features |
|---|---|
| `all` | The 20 features selected by the preprocessor |
| `noport` | Same as `all` with Destination Port removed |
| `portdur` | Destination Port + Flow Duration (simple baseline) |
| `portonly` | Destination Port only (simple baseline) |

### Data files:

| File | Content |
|---|---|
| `data/sample_A2.csv` | Training sample (2,997 usable rows: 1,498 benign, 600 DoS, 449 PortScan, 450 BruteForce), split 80/20 with seed 42 |
| `data/sample_V.csv` | Attack variants held out of training: slowloris, Slowhttptest, SSH-Patator, PortScan, benign (1,304 rows) |
| `data/sample_C.csv` | Realistic mix, mostly benign (9,914 rows, 8,360 benign) |
| `data/sample_B.csv` | New rows of attack types that are in training (499 rows). Near-copies of A2 rows, so **not** evidence of generalization |

---

## 4. Chosen Settings

| Model | Setting (chosen by cross-validation) |
|---|---|
| KNN | Manhattan distance ($p=1$), $K=1$, unweighted |
| Decision Tree | Unlimited depth (`maxDepth = 0`), `minSamplesLeaf = 2` (55 leaves, depth 13) |

---

## 5. Experimental Results

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

### Simple baselines on C, for context:

| Feature set | KNN false alarms | Tree false alarms | KNN alert precision | Tree alert precision |
|---|---|---|---|---|
| `all` | 2.2% | 2.7% | 88.9% | 86.9% |
| `portdur` | 11.8% | 12.7% | 59.3% | 57.8% |
| `portonly` | 15.8% | 15.9% | 52.6% | 52.6% |

---

## 6. Findings

- On traffic similar to the training data, both models perform very well and give 4 to 7 times fewer false alarms than the simple port and duration baselines.
- KNN and the Decision Tree are close in accuracy. KNN has slightly fewer false alarms. The Decision Tree is roughly 1,000 times faster (~0.4 ms vs ~506 ms) and can be fully inspected as readable rules.
- **Neither model generalizes to attack types it has not seen.** Slow DoS (slowloris, Slowhttptest) looks like normal traffic to them and is almost completely missed. The simple port+duration model catches about 88% of it, but at about 12% false alarms.
- Training on the first sample alone gave only 65% (KNN) and 78% (tree) accuracy on DDoS and web brute force files. Adding those types to training fixed it, because they became known types.

---

## 7. Limitations

- The data contains many near-identical flows, so scores on familiar traffic are optimistic. This is also why $K=1$ and small `minSamplesLeaf` win in cross-validation.
- Sample C is about 16% attacks. A real network has far fewer, so real-world alert precision would be lower.
- Sample C has only 51 BruteForce rows, so BruteForce precision (about 31 to 39%) is noisy.
- All figures come from sampled CICIDS2017 data, not live traffic.

---

## 8. Build and Run

### Compilation

Compile the tuning and evaluation tools with C++17:

```bash
# KNN tuning tool
g++ -O2 -std=c++17 -Iinclude tools/tune_knn.cpp src/ml/knn.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_knn

# Decision Tree tuning tool
g++ -O2 -std=c++17 -Iinclude tools/tune_tree.cpp src/ml/decision_tree.cpp src/data/preprocessor.cpp src/data/dataset.cpp src/data/cleaner.cpp src/data/csv_loader.cpp -o tune_tree
```

### Hyperparameter Tuning (Stratified 5-Fold CV)

Tune on the training sample (writes `knn_cv_results.csv` and `tree_cv_results.csv`):

```bash
./tune_knn data/sample_A2.csv
./tune_tree data/sample_A2.csv
```

### Final Evaluation on Held-Out and External Samples

Run final evaluation with the selected optimal settings:

```bash
./tune_knn  data/sample_A2.csv final all 1 1 0 data/sample_V.csv data/sample_C.csv data/sample_B.csv
./tune_tree data/sample_A2.csv final all 0 2   data/sample_V.csv data/sample_C.csv data/sample_B.csv
```

**CLI Argument syntax:**
- KNN: `final <feature_set> <p> <K> <weighted> [other.csv ...]`
- Tree: `final <feature_set> <maxDepth> <minLeaf> [other.csv ...]`
- Feature sets: `all`, `noport`, `portdur`, `portonly`.

---

## 9. Using the Models in C++

```cpp
#include "knn.h"
#include "decision_tree.h"
#include "preprocessor.h"

// 1. Prepare data with standard preprocessing
PrepareOptions opt;
PreparedData p = prepareDataset("data/sample_A2.csv", opt);

// 2. K-Nearest Neighbours
KnnOptions ko;
ko.k = 1;
ko.p = 1.0;
ko.distanceWeighted = false;
KNN knn(ko);
knn.fit(p.train);
std::vector<int> knnPreds = knn.predictAll(p.test.X);

// 3. CART Decision Tree
TreeOptions to;
to.maxDepth = 0;        // unlimited depth
to.minSamplesLeaf = 2;
DecisionTree tree(to);
tree.fit(p.train);
std::vector<int> treePreds = tree.predictAll(p.test.X);
```

Other CSV files are prepared with the training statistics through `prepareLike(p, path, nullptr)` so they are scaled identically to the training data.
