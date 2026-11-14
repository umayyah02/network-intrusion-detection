# Dataset and Preprocessing

Owner: Member 1 (dataset processing). Covers FR-D1 to FR-D6. This is the contract for the data both models receive: required columns, label mapping and preprocessing rules.

## 1. Source data and required columns

- CICIDS2017 flow-feature CSVs (MachineLearningCVE, one file per capture day). Not committed: download them from the official CICIDS2017 page and put them in data/full/ (git-ignored).
- Required columns: the 78 numeric feature columns of those files (same header in every file), then Label as the last column. Header names are trimmed of spaces. Label is the only categorical column. The original files contain the column "Fwd Header Length" twice; both copies are kept as they are.
- Code: include/csv_loader.h, include/dataset.h, include/cleaner.h, include/preprocessor.h and src/data/*.cpp.

## 2. Sample files

Built by tools/make_sample.cpp (reservoir sampling, fixed seed, fixed rows per class). All six sample files are committed in data/. Use the committed files; regenerating on another compiler may select different rows.

| Set | File | Use | Content (rows requested) |
|---|---|---|---|
| A | data/sample_1000.csv | First sample, kept for comparison | BENIGN 400, DoS 200, PortScan 200, BruteForce 200. No DDoS, no web brute force. |
| A2 | data/sample_A2.csv | Training | BENIGN 1500, DoS 600 (Hulk, GoldenEye, DDoS), PortScan 450, BruteForce 450 (FTP-Patator, web brute force). Held out: slowloris, Slowhttptest, SSH-Patator. |
| V | data/sample_V.csv | Test only: held-out variants | BENIGN 600, DoS 300 (slowloris, Slowhttptest), PortScan 150, BruteForce 300 (SSH-Patator). |
| B | data/sample_B.csv | Consistency check only, not held out: DDoS and web brute force are in A2 training, and B rows are near-copies of A2 rows, so B is not evidence of generalization | BENIGN 200, DoS 100, PortScan 100, BruteForce 100. |
| C | data/sample_C.csv | Test only: realistic mix (84% benign) | BENIGN 8424, DoS 936, PortScan 589, BruteForce 51. About 10,000 rows. |
| A3 | data/sample_A3.csv | Final training sample for the demo model: every variant of the three families | BENIGN 2000, DoS 1000 (Hulk, GoldenEye, slowloris, Slowhttptest, DDoS, 200 each), PortScan 500, BruteForce 600 (FTP-Patator, SSH-Patator, web brute force, 200 each). 4,100 rows requested. Since all variants are in training, V and B no longer test a model trained on A3. |

The exclude lists keep A2 free of rows from A, B and C; V free of rows from A, B, C and A2; and A3 free of rows from A, B, C and V. A3 can share rows with A2, because both are drawn from the same data. Exclusion catches exact copies only; near-identical rows between samples (for example A2 and B/C) are still possible.

Commands (all CICIDS csv files are passed as input; --raw-labels keeps the original label, the loader maps it):

```
make_sample data/sample_A2.csv <csv files> --extra-attacks --skip-variants slowloris,slowhttptest,ssh-patator
  --balance-variants --raw-labels --exclude data/sample_1000.csv --exclude data/sample_B.csv
  --exclude data/sample_C.csv --seed 31 --quota BENIGN=1500 --quota DoS=600 --quota PortScan=450 --quota BruteForce=450

make_sample data/sample_V.csv <csv files> --only-variants slowloris,slowhttptest,ssh-patator,portscan
  --balance-variants --raw-labels --exclude data/sample_1000.csv --exclude data/sample_B.csv
  --exclude data/sample_C.csv --exclude data/sample_A2.csv --seed 41
  --quota BENIGN=600 --quota DoS=300 --quota PortScan=150 --quota BruteForce=300

make_sample data/sample_B.csv <csv files> --extra-only --raw-labels --exclude data/sample_1000.csv
  --seed 7 --quota BENIGN=200 --quota DoS=100 --quota PortScan=100 --quota BruteForce=100

make_sample data/sample_C.csv <csv files> --exclude data/sample_1000.csv --exclude data/sample_B.csv
  --seed 21 --quota BENIGN=8424 --quota DoS=936 --quota PortScan=589 --quota BruteForce=51

make_sample data/sample_A3.csv <csv files> --extra-attacks --balance-variants --raw-labels
  --exclude data/sample_1000.csv --exclude data/sample_B.csv --exclude data/sample_C.csv
  --exclude data/sample_V.csv --seed 51 --quota BENIGN=2000 --quota DoS=1000 --quota PortScan=500 --quota BruteForce=600
```

Which sample is used for what: A3 trains the final demo model. A2 with V (and the leave-one-variant-out test on A2) is the generalization study; it is kept separate because V no longer tests a model trained on A3. C is test only for every model (false alarms and alert precision). Model results are in docs/results/.

Options: --seed, --quota CLASS=N, --extra-attacks, --extra-only, --only-variants, --skip-variants, --balance-variants, --raw-labels, --exclude FILE. With no options the sampler reproduces sample_1000.csv. Option details are in the header comment of tools/make_sample.cpp.

## 3. Label mapping (fixed order for the whole team)

| Index | Class | Raw labels mapped to it |
|---|---|---|
| 0 | BENIGN | BENIGN |
| 1 | DoS | DoS Hulk, DoS GoldenEye, DoS slowloris, DoS Slowhttptest, DDoS |
| 2 | PortScan | PortScan |
| 3 | BruteForce | FTP-Patator, SSH-Patator, Web Attack - Brute Force |

Case and surrounding spaces are ignored. Any other label (Bot, Infiltration, Heartbleed, XSS, SQL Injection) is skipped and counted as "unknown label".

## 4. Cleaning rules (FR-D2)

| Problem | What happens | Reported as |
|---|---|---|
| Non-numeric cell, trailing junk (12abc), empty cell, NaN, Infinity | Row skipped | skipped invalid |
| Wrong number of columns | Row skipped | skipped invalid |
| Label outside the 4 classes | Row skipped | unknown label |
| Same features and same label | First copy kept | duplicates removed |
| Same features, different labels | Kept | conflicting feature rows |
| File cannot be opened, or bad header | Error (exception, exit code 2) | not an empty dataset |

## 5. Preprocessing pipeline (FR-D3, FR-D4, FR-D5)

prepareDataset(path, options) runs, in this order:

1. Load, clean and validate (sizes, row widths, label range, finite values).
2. Optional column choice: options.keepOnlyColumns / options.dropColumns (for baselines). An unknown column name is an error.
3. Stratified 80 / 20 train/test split, fixed seed 42. Each class is split separately; own Fisher-Yates shuffle on std::mt19937, so the split is the same on any compiler.
4. One-hot encoding of categorical feature columns, categories learned from train only. CICIDS has no categorical feature column (no Protocol), so this step does nothing here.
5. Feature selection, fitted on train only.
6. Scaling, fitted on train only.

Anything that learns statistics is fitted on the training set and applied unchanged to the test set (no leakage).

Scaling: binary columns (only 0/1 in train) stay as they are. Non-negative, non-binary columns get log(1 + x) first, because flow features are heavily skewed. Everything else is z-scored with train mean and std. Columns with negative values (Init_Win_bytes_*, -1 means "no data") are only z-scored. options.logTransform = false gives plain z-score.

Feature selection: drop constant features; rank the rest by Fisher score (between-class / within-class variance); skip a feature whose absolute correlation with an already kept one is above 0.95; keep at most 20. Reason: constant and near-duplicate features add no information and slow down KNN.

prepareLike(p, path, nullptr) prepares another file (V, C, B) with the same columns, encoder, selected features and scaling taken from the training data. It stops with an error if the columns differ.

## 6. Selected features and sample statistics

Final model, sample A3 (loader output, seed 42):

- Usable rows after cleaning: 4,079 of 4,100 (1 invalid row and 20 duplicates removed, 0 unknown labels, 0 conflicting rows). BENIGN 1,999, DoS 998, PortScan 500, BruteForce 582.
- Split: 3,263 train / 816 test (stratified). Train: BENIGN 1,599, DoS 798, PortScan 400, BruteForce 466. Test: BENIGN 400, DoS 200, PortScan 100, BruteForce 116.
- Feature selection from 78 columns: 8 constant dropped, 10 dropped as correlated, 40 ranked below the top 20.
- Selected features (20), in original column order:

1. Flow Duration
2. Bwd Packet Length Min
3. Bwd Packet Length Std
4. Flow IAT Mean
5. Flow IAT Std
6. Flow IAT Max
7. Fwd IAT Mean
8. Fwd IAT Std
9. Bwd IAT Std
10. Bwd IAT Max
11. Min Packet Length
12. Packet Length Variance
13. PSH Flag Count
14. Down/Up Ratio
15. Average Packet Size
16. Init_Win_bytes_forward
17. min_seg_size_forward
18. Active Mean
19. Active Max
20. Idle Min

Generalization study, sample A2: 2,997 usable rows (BENIGN 1,498, DoS 600, PortScan 449, BruteForce 450), split 2,397 train / 600 test. Selected features (20): Flow Duration, Bwd Packet Length Min, Bwd Packet Length Mean, Flow IAT Mean, Flow IAT Std, Fwd IAT Mean, Fwd IAT Std, Fwd PSH Flags, Bwd Packets/s, Min Packet Length, Max Packet Length, Packet Length Variance, PSH Flag Count, ACK Flag Count, Down/Up Ratio, Average Packet Size, Init_Win_bytes_forward, Init_Win_bytes_backward, min_seg_size_forward, Idle Max.

Destination Port is not among the selected features in either sample. For any other file the loader prints its own list: ./loader data/sample_A3.csv.

## 7. How to use it

```cpp
#include "preprocessor.h"

PrepareOptions opt;                    // seed 42, 80/20, 20 features, log transform on
PreparedData p = prepareDataset("data/sample_A3.csv", opt);   // final model: train on p.train, test on p.test
Dataset c = prepareLike(p, "data/sample_C.csv", nullptr);     // realistic mix, test only

// Generalization study: prepareDataset("data/sample_A2.csv", opt), then
// Dataset v = prepareLike(p, "data/sample_V.csv", nullptr);  // held-out variants
```

Class indexes: BENIGN = 0, DoS = 1, PortScan = 2, BruteForce = 3. Both models use the same test files. Tune only with cross-validation on p.train; never on V, C or B.

## 8. Build and test

```
g++ -std=c++17 -Wall -Wextra -Iinclude src/main.cpp src/data/cleaner.cpp src/data/csv_loader.cpp
    src/data/dataset.cpp src/data/preprocessor.cpp -o loader
./loader data/sample_A2.csv

g++ -std=c++17 -Wall -Wextra -Iinclude src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp
    src/data/preprocessor.cpp tests/testdata.cpp -o test_data
./test_data

g++ -std=c++17 -O2 tools/make_sample.cpp -o make_sample
```

## 9. Known limitations

- Samples are small and balanced; C is 16% attacks, a real network has far fewer.
- Many rows are near-duplicates, so scores on familiar traffic are optimistic.
- C has only 51 BruteForce rows, so BruteForce numbers on C are noisy.
- Slow DoS and SSH-Patator are only partly different from the training attacks (same port 80 or login ports), so V is hard for slow DoS: both models almost completely miss it (0.3% to 6% recall) and macro-F1 on V is 0.63 to 0.68.
- A3 contains every variant of the three attack families, so it measures recognition of known attacks. No sample tests attack types outside CICIDS2017; that would need a second dataset.
- Only four classes are modelled; other CICIDS attacks are skipped.
- Because "Fwd Header Length" appears twice, keepOnlyColumns / dropColumns by that name match the first copy only.
- Sampling happens before cleaning, so class counts shift slightly after cleaning.