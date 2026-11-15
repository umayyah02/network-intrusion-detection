# Testing Guide

Owner: Member 4 (Integration and Testing).

Tests use plain checks with no extra library.

## 1. Run the existing data tests

From the project root:

```bash
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testdata.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_data
./test_data
```
On Windows PowerShell, run `.\test_data.exe` instead of `./test_data`.
Expected last line: `All data-layer tests passed`.

## 2. Automated test suites

| Test file | What it checks | Run it with (planned) |
|---|---|---|
| `tests/testmodels.cpp` (done) | Decision Tree, KNN and `evaluate()` on tiny hand-made data with known answers; bad input gives clear errors | see section 2a |
| `tests/testpipeline.cpp` (done) | Whole chain on `data/sample_A2.csv`: clean, split, scale, train both models, predict, metrics. Checks the split, no leakage, same seed gives same split, both models beat a lazy baseline, and a second file (`sample_B.csv`) works | see section 2b |
| `tests/testbadinput.cpp` (done) | Bad input in section 3: clear errors or skipped-and-counted rows, never a crash | see section 2c |

### 2a. Run the model tests

```bash
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testmodels.cpp src/ml/knn.cpp src/ml/decision_tree.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_models
./test_models
```
On Windows PowerShell, run `.\test_models.exe`. Expected last line: `All model and metrics tests passed`.

### 2b. Run the pipeline test

Run it from the **project root** (it reads files in `data/`).

```bash
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testpipeline.cpp src/ml/knn.cpp src/ml/decision_tree.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_pipeline
./test_pipeline
```
On Windows PowerShell, run `.\test_pipeline.exe`. Expected last line: `All pipeline tests passed`.

### 2c. Run the bad-input tests

Run from the **project root**. The tests make small temporary CSV files and delete them again.

```bash
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testbadinput.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_badinput
./test_badinput
```
On Windows PowerShell, run `.\test_badinput.exe`. Expected last line: `All bad-input tests passed`. Lines starting with `KNOWN ISSUE` are weak spots to discuss with Member 1; they do not fail the run.

Known issues found so far:
1. A CSV with no label column stops with "Not enough usable rows to split (0)". It never says the label column is missing (the loader treats the last column as the label).
2. A very small CSV (4 rows) is accepted but gives an empty test set, so any score would be meaningless.

## 3. Bad input checklist

Try each one. The program must give a clear error and must not crash.

- [ ] Empty file
- [ ] File that is not a CSV (for example a picture renamed to `.csv`)
- [ ] CSV with a missing label column
- [ ] CSV with text or empty values where numbers are expected
- [ ] CSV with only the header row
- [ ] File path that does not exist
- [ ] Very large file
- [ ] Unknown label in the label column



## 4. Speed and complexity experiments

### Experiment configuration

- Dataset: `sample_A3.csv` (loaded as `uploads/sample_A3.csv`)
- Total records: 4,079
- Training records: 3,263
- Test records: 816
- Features: 20
- Classes: 4
- Models: Decision Tree and KNN
- Training-data fractions: 10%, 25%, 50%, 100%
- Repetitions: 3 per configuration
- Random seed: 42
- Experiment date: November 14, 2026

### Hardware

- CPU: 11th Gen Intel Core i5-1135G7 @ 2.40 GHz
- RAM: 11.73 GB

### Procedure

1. Load the A3 dataset and use the prepared training and test split.
2. Train both models using 10%, 25%, 50%, and 100% of the training records.
3. Use the same full test split (816 records) for every experiment.
4. Repeat each configuration three times and record average training and prediction times.
5. Save the raw backend response in `complexity_A3_job5_2026-11-14.json`.
6. Convert the average timings from milliseconds to seconds and save them in `complexity_results_A3.csv` using the format:
   `model,rows,trainSeconds,predictSeconds`.
7. Generate training-time and prediction-time graphs using `plot_complexity.py`.
8. Compare measured trends with theoretical algorithm complexity.
9. Calculate execution-time growth ratios between consecutive dataset sizes and save them in `complexity_growth_ratios_A3.csv`.

### Results and observations

Average execution times across 3 repetitions:

| Model | Training records | Training time (seconds) | Prediction time (seconds) |
|---|---:|---:|---:|
| Decision Tree | 327 | 0.003344 | 0.000055 |
| Decision Tree | 817 | 0.006679 | 0.000059 |
| Decision Tree | 1,632 | 0.013970 | 0.000057 |
| Decision Tree | 3,263 | 0.038112 | 0.000065 |
| KNN | 327 | 0.000060 | 0.015328 |
| KNN | 817 | 0.000158 | 0.026983 |
| KNN | 1,632 | 0.000235 | 0.054742 |
| KNN | 3,263 | 0.000445 | 0.103408 |

Observations:

- Decision Tree training time increased as the training dataset grew.
- Decision Tree prediction time remained very low and relatively stable while the test set stayed fixed at 816 records.
- KNN training time remained comparatively low because it mainly stores the training records.
- KNN prediction time increased as the training dataset grew because predictions require comparisons with stored training records.
- The observed trends broadly align with the expected behaviour of both algorithms.
- The prediction-time graph uses a logarithmic Y-axis because the prediction times of the two models differ substantially.
- All configurations used the same 816 test records.

### Growth-ratio analysis

The growth-ratio analysis compares the change in execution time with the change in training dataset size between consecutive configurations.

| Model | Measurement | Observed execution-time growth |
|---|---|---|
| Decision Tree | Training | 1.997x, 2.092x, 2.728x |
| Decision Tree | Prediction | 1.073x, 0.966x, 1.140x |
| KNN | Training | 2.633x, 1.487x, 1.894x |
| KNN | Prediction | 1.760x, 2.029x, 1.889x |

The corresponding dataset-size increases were approximately 2.0x to 2.5x.

Observations:

- Decision Tree training time generally increased with dataset size, with a larger increase in the final interval.
- Decision Tree prediction time remained relatively stable.
- KNN prediction time increased approximately in proportion to dataset size.
- KNN training measurements increased, although its training operation primarily involves storing the training records.

These ratios are based on four dataset sizes and should be treated as experimental observations, not proof of asymptotic complexity.

### Theoretical complexity

Let `n` represent the number of training records, `f` the number of features, and `h` the height of the Decision Tree.

| Model | Training complexity | Prediction complexity |
|---|---|---|
| Decision Tree | O(n f log n) | O(h) per record |
| KNN | Stores training records | Approximately O(n f) per query on average in this implementation |

The KNN implementation uses `nth_element` to select the nearest neighbours. Its prediction work therefore grows with the number of stored training records.

The theoretical growth curves in the graphs are normalized to the final measured execution time. They illustrate theoretical growth patterns and are not actual predicted execution times.

These theoretical complexities describe expected algorithmic behaviour; the measured execution times are practical observations and do not prove asymptotic complexity.

### Memory measurement limitation

Memory usage was not returned by the backend (`memoryBytes: null`) and is therefore reported as unavailable rather than estimated.

### Limitations

- Execution times are wall-clock measurements from the server machine and may vary across hardware and runs.
- Results are based on one dataset and one machine.
- Only average timings were returned; individual repetition timings and variation were not available.
- Memory usage could not be measured because the backend returned `memoryBytes: null`.
- Four dataset sizes are insufficient to establish asymptotic complexity experimentally.

### Evidence files

- `complexity_A3_job5_2026-11-14.json` — raw backend experiment response
- `complexity_results_A3.csv` — recorded average measurements
- `complexity_metadata_A3.json` — experiment configuration and hardware details
- `complexity_training.png` — training-time graph
- `complexity_prediction.png` — prediction-time graph
- `complexity_growth_ratios_A3.csv` — execution-time growth-ratio analysis
- `plot_complexity.py` — graph-generation and analysis script

## 5. QA Status

- Four automated test suites passed.
- API smoke tests: 50/50 passed on the tested project snapshot.
- Frontend production build succeeded; a large-bundle warning remains.
- Dashboard, detection, threats, results and complexity workflows were tested.
- Refreshing some pages redirects to the dashboard; reported for frontend review.
- Detection results disappearing after refresh were reported for frontend review.
- Severity display needs final runtime verification.
- Replay, model save/load and JSON export are not implemented.
- Backend memory usage is unavailable (`memoryBytes: null`).

## 6. Definition of done

- Every test builds and passes with the commands in this file, on a fresh clone.
- Every item in section 3 was tried and the result is written down.
- Experiment results are saved in the repo and used in the report.