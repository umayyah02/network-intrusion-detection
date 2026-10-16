# Dataset and Preprocessing (Data Layer)

Owner: Aizah (Member 1, data layer)
Project: Intelligent Network Intrusion Detection and Threat Analysis System
Covers: FR-D1 to FR-D6 of PRD v1.2

## 1. Purpose

This document describes the data every model receives: where it comes from, how it is cleaned, how labels are encoded, how features are selected and scaled, and how it is split. Decision Tree and KNN get exactly the same prepared data (PRD team rule).

## 2. Source and sample

- Source data: CICIDS2017 flow-feature CSV files. All feature columns are numeric; the only categorical column is Label. The full dataset is NOT committed to the repository (download it from the official CICIDS2017 page and keep it in data/full/, which is git-ignored).
- Reference sample: data/sample_1000.csv, built by tools/make_sample.cpp.
- Method: reservoir sampling with a fixed seed (42) and a fixed number of rows per class: BENIGN 400, DoS 200, PortScan 200, BruteForce 200 (1,000 raw rows).
- Usage: make_sample data/sample_1000.csv input1.csv [input2.csv ...]
- Raw labels kept by the sampler: BENIGN, DoS Hulk, DoS GoldenEye, DoS slowloris, DoS Slowhttptest, PortScan, FTP-Patator, SSH-Patator.
- The sample is class-balanced on purpose. The real dataset is dominated by BENIGN, so accuracy on this sample is not real-world accuracy; evaluation must report per-class precision and recall.
- Sampling happens before cleaning, so fewer than 1,000 rows remain after cleaning (see section 9).
- data/sample_1000.csv is the committed reference file. Regenerating it on a different compiler may select different rows, so always use the committed file.

## 3. Input format

- First line: header. Header names are trimmed of leading and trailing spaces (CICIDS headers have leading spaces).
- Every column except the last is a numeric feature. The last column is Label.
- Code: include/csv_loader.h, src/data/csv_loader.cpp.

## 4. Label encoding (fixed order for the whole team)

| Index | Class      | Raw labels mapped to it                                        |
|-------|------------|----------------------------------------------------------------|
| 0     | BENIGN     | BENIGN                                                         |
| 1     | DoS        | DoS Hulk, DoS GoldenEye, DoS slowloris, DoS Slowhttptest, DDoS |
| 2     | PortScan   | PortScan                                                       |
| 3     | BruteForce | FTP-Patator, SSH-Patator, Web Attack - Brute Force             |

Matching ignores case and surrounding spaces. Any other label (Bot, Infiltration, Heartbleed, XSS, SQL Injection) is skipped and counted as "unknown label". The loader accepts DDoS and Web Attack - Brute Force, but the 1,000-row sample does not contain them.

## 5. Cleaning rules (FR-D2)

| Problem                                                                                           | What happens                   | Reported as              |
|---------------------------------------------------------------------------------------------------|--------------------------------|------------------------  |
| Non-numeric cell, trailing junk (for example 12abc), empty cell, NaN, Infinity, hex               | Row skipped                    | skipped invalid          |
| Wrong number of columns                                                                           | Row skipped                    | skipped invalid          |
| Label outside the 4 classes                                                                       | Row skipped                    | unknown label            |
| Same features and same label                                                                      | First copy kept                | duplicates removed       |
| Same features, different labels                                                                   | Kept (not removed)             | conflicting feature rows |
| File cannot be opened, or bad header                                                              | Error (exception, exit code 2) | not an empty dataset     |

A readable file with zero usable rows returns an empty dataset; a failed load is always an error.

## 6. Preprocessing pipeline (FR-D3, FR-D4, FR-D5)

One call: prepareDataset(path, options) in include/preprocessor.h. Order:

1. Load and clean (section 5), then validate: X and y sizes match, every row has the right width, label indexes are in range, all values finite.
2. Stratified train/test split, 80 / 20, fixed seed 42 (FR-D5).
3. One-hot encoding of categorical feature columns, for example Protocol, if present (FR-D3). Categories are learned from the training set only. A category that appears only in the test set becomes all zeros.
4. Feature selection, fitted on the training set only (FR-D4).
5. Scaling, fitted on the training set only (FR-D3).

Rule from the PRD: anything that learns statistics (categories, selected features, mean, standard deviation) is fitted on the training set and then applied unchanged to the test set. No data leakage.

### Split (FR-D5)

- Each class is split separately, so train and test keep the same class proportions.
- A class with 2 or more rows always has at least 1 row in train and 1 in test.
- The shuffle is our own Fisher-Yates driven by std::mt19937(seed), because std::shuffle can give a different order on different compilers. The same seed gives the same split on any machine.

### Scaling (FR-D3)

- Binary columns (every training value is 0 or 1: flag counts, one-hot columns) are left as they are.
- Non-negative, non-binary columns get log(1 + x) first. Network flow features (durations, byte counts, inter-arrival times) are heavily skewed with huge outliers, and plain z-score would squeeze normal traffic into a tiny cluster. Negative test values are clamped to 0 before the log.
- All other values are z-scored: (x - mean) / std, using training statistics. A constant column becomes all zeros.
- Scaling is required for KNN (distance based). Decision Trees do not need it, but both models receive the same data. To get plain z-score without the log step, set options.logTransform = false.

### Feature selection (FR-D4) and why

1. Drop constant features (zero variance in training): they carry no information.
2. Rank the remaining features by Fisher score (between-class variance divided by within-class variance): features whose values differ most between classes, relative to the spread inside each class, rank highest.
3. Walk down the ranking and skip any feature whose absolute Pearson correlation with an already kept feature is above 0.95: near-duplicate features add noise and slow down KNN without adding information.
4. Keep at most 20 features (default). Fewer dimensions make KNN faster and distances more meaningful.

Settings (maxFeatures = 20, correlation limit 0.95) are defaults in PrepareOptions and can be changed.

## 7. How Member 2 uses it

```cpp
#include "preprocessor.h"

PrepareOptions opt;                    // seed 42, 80/20, 20 features, log transform on
opt.oneHotColumns = {"Protocol"};      // ignored if the CSV has no such column
PreparedData p = prepareDataset("data/sample_1000.csv", opt);

// p.train and p.test are Dataset objects: scaled, same feature columns.
// p.train.X, p.train.y, p.train.featureNames, p.train.classNames
// p.scaler, p.selector, p.encoder can be reused to prepare a single new flow.
```

Class indexes: BENIGN = 0, DoS = 1, PortScan = 2, BruteForce = 3. Both models are evaluated on the same p.test.

## 8. Build, run, test

```
g++ -std=c++17 -Wall -Wextra -Iinclude src/main.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o loader
./loader data/sample_1000.csv [seed]

g++ -std=c++17 -Wall -Wextra -Iinclude src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp tests/testdata.cpp -o test_data
./test_data
```

Tests cover: label mapping, unknown labels, dataset validation (ragged rows, bad labels, NaN, size mismatch), duplicates and conflicting rows, split reproducibility and stratification, train-only scaling, binary columns and log transform, feature selection (constant and correlated features), one-hot encoding with unseen categories, and CSV parsing of bad cells and missing files.

## 9. Results on data/sample_1000.csv

Produced by the loader with the default settings (seed 42, 80 / 20 split, up to 20 features, log transform on).

| Step                                                          | Result    |
|---------------------------------------------------------------|-----------|
| Raw rows in the sample                                        | 1,000     |
| Skipped invalid (NaN, Infinity, bad cell, wrong column count) | 1         |
| Unknown label                                                 | 0         |
| Duplicates removed                                            | 64        |
| Conflicting feature rows (same features, different labels)    | 0         |
| Rows after cleaning                                           | 935       |
| Feature columns before selection                              | 78        |
| Train rows / test rows                                        | 747 / 188 |

Class distribution after cleaning (the sample was 400 / 200 / 200 / 200 before cleaning):

| Class      | All rows    | Train       | Test       |
|------------|-------------|-------------|------------|
| BENIGN     | 399 (42.7%) | 319 (42.7%) | 80 (42.6%) |
| DoS        | 163 (17.4%) | 130 (17.4%) | 33 (17.6%) |
| PortScan   | 200 (21.4%) | 160 (21.4%) | 40 (21.3%) |
| BruteForce | 173 (18.5%) | 138 (18.5%) | 35 (18.6%) |

Most duplicates were attack flows (DoS 200 to 163, BruteForce 200 to 173). Train and test keep the same class proportions because the split is stratified.

Feature selection (fitted on the 747 training rows): 12 constant features dropped, 15 dropped as correlated with a better-ranked feature (|r| above 0.95), 31 dropped because they ranked below the top 20. 78 - 12 - 15 - 31 = 20 kept.

Selected features (20, in original column order):

1. Destination Port
2. Fwd Packet Length Min
3. Bwd Packet Length Min
4. Bwd Packet Length Mean
5. Flow IAT Mean
6. Fwd IAT Total
7. Fwd IAT Mean
8. Bwd IAT Std
9. Fwd Header Length
10. Bwd Header Length
11. Min Packet Length
12. Max Packet Length
13. Packet Length Variance
14. FIN Flag Count
15. PSH Flag Count
16. ACK Flag Count
17. Average Packet Size
18. Init_Win_bytes_forward
19. min_seg_size_forward
20. Idle Mean

If the column list of the CSV has no Protocol column (as in the standard 78-feature CICIDS2017 files), the one-hot step does nothing and Label is the only categorical column.

## 10. Known limitations

- The sample is balanced and small; it is for development and demos, not for real-world accuracy figures.
- Sampling happens before cleaning, so class counts shift slightly after cleaning.
- Rows with identical features but different labels are kept, so a perfect score on such rows is impossible.
- Feature selection and scaling settings were chosen by us and should be confirmed with the team.

## 11. Requirement checklist

| ID    | Requirement                                      | Status                       |
|-------|--------------------------------------------------|------------------------------|
| FR-D1 | Load CSV, show rows, columns, class distribution | Done (loader output)         |
| FR-D2 | Clean missing, invalid, duplicate records        | Done                         |
| FR-D3 | Encode categorical, scale numeric                | Done                         |
| FR-D4 | Select features and document why                 | Done (section 6)             |
| FR-D5 | Reproducible, stratified split                   | Done                         |
| FR-D6 | Sampling to a manageable size (P1)               | Done (tools/make_sample.cpp) |
