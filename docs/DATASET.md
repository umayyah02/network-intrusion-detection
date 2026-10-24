# Dataset and Preprocessing

Owner: Member 1 (dataset processing). Covers FR-D1 to FR-D6. This is the contract for the data both models receive: required columns, label mapping and preprocessing rules.

## 1. Source data and required columns

- CICIDS2017 flow-feature CSVs (MachineLearningCVE, one file per capture day). Not committed: download them from the official CICIDS2017 page and put them in data/full/ (git-ignored).
- Required columns: the 78 numeric feature columns of those files (same header in every file), then Label as the last column. Header names are trimmed of spaces. Label is the only categorical column.
- Code: include/csv_loader.h, include/dataset.h, include/cleaner.h, include/preprocessor.h and src/data/*.cpp.

## 2. Sample files

Built by tools/make_sample.cpp (reservoir sampling, fixed seed, fixed rows per class). Use the committed files; regenerating on another compiler may select different rows.

| Set | File | Use | Content (rows requested) |
|---|---|---|---|
| A | data/sample_1000.csv | First sample, kept for comparison | BENIGN 400, DoS 200, PortScan 200, BruteForce 200. No DDoS, no web brute force. |
| A2 | data/sample_A2.csv | Training | BENIGN 1500, DoS 600 (Hulk, GoldenEye, DDoS), PortScan 450, BruteForce 450 (FTP-Patator, web brute force). Held out: slowloris, Slowhttptest SSH-Patator. |
| V | data/sample_V.csv | Test only: held-out variants | BENIGN 600, DoS 300 (slowloris, Slowhttptest), PortScan 150, BruteForce 300 (SSH-Patator). |
| B | data/sample_B.csv | Test only: DDoS and web brute force | BENIGN 200, DoS 100, PortScan 100, BruteForce 100. |
| C | data/sample_C.csv | Test only: realistic mix (84% benign) | BENIGN 8424, DoS 936, PortScan 589, BruteForce 51. About 10,000 rows, shared directly and not committed. |

No row of A2, V, B or C is identical to a row in an earlier sample (the exclude list catches exact copies only).

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
```

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

prepareLike(p, path) prepares another file (V, C, B) with the same columns, encoder, selected features and scaling taken from the training data. It stops with an error if the columns differ.

## 6. Selected features (sample A2)

20 features, in original column order:

1. Flow Duration
2. Bwd Packet Length Min
3. Bwd Packet Length Mean
4. Flow IAT Mean
5. Flow IAT Std
6. Fwd IAT Mean
7. Fwd IAT Std
8. Fwd PSH Flags
9. Bwd Packets/s
10. Min Packet Length
11. Max Packet Length
12. Packet Length Variance
13. PSH Flag Count
14. ACK Flag Count
15. Down/Up Ratio
16. Average Packet Size
17. Init_Win_bytes_forward
18. Init_Win_bytes_backward
19. min_seg_size_forward
20. Idle Max

A2 has 2,997 usable rows (BENIGN 1,498, DoS 600, PortScan 449, BruteForce 450), split 2,397 train / 600 test. Destination Port is not among the selected features.

## 7. How to use it

```cpp
#include "preprocessor.h"

PrepareOptions opt;                    // seed 42, 80/20, 20 features, log transform on
PreparedData p = prepareDataset("data/sample_A2.csv", opt);   // train on p.train, test on p.test
Dataset v = prepareLike(p, "data/sample_V.csv");              // held-out variants
Dataset c = prepareLike(p, "data/sample_C.csv");              // realistic mix
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
- Slow DoS and SSH-Patator are only partly different from the training attacks (same port 80 or login ports), so V is a fair but not a hard test.
- Only four classes are modelled; other CICIDS attacks are skipped.
- Sampling happens before cleaning, so class counts shift slightly after cleaning.