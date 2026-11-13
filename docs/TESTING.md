# Testing Guide (DRAFT)

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

- Dataset: `sample_A3.csv`
- Total records: 4,079
- Training records: 3,263
- Test records: 816
- Models: Decision Tree and KNN
- Training-data fractions: 10%, 25%, 50%, 100%
- Repetitions: 3 per configuration
- Random seed: 42

### Hardware

- CPU: 11th Gen Intel Core i5-1135G7 @ 2.40 GHz
- RAM: 11.73 GB

### Procedure

1. Load the dataset and use the prepared training and test split.
2. Train both models using 10%, 25%, 50%, and 100% of the training records.
3. Use the same full test split (816 records) for every experiment.
4. Repeat each configuration three times and record average training and prediction times.
5. Save measurements in `complexity_results_A3.csv` using the format:
   `model,rows,trainSeconds,predictSeconds`.
6. Generate training-time and prediction-time graphs using `plot_complexity.py`.
7. Compare measured trends with theoretical algorithm complexity.


### Results and observations

Average execution times across 3 repetitions:

| Model | Training records | Training time (seconds) | Prediction time (seconds) |
|---|---:|---:|---:|
| Decision Tree | 327 | 0.002587 | 0.000111 |
| Decision Tree | 817 | 0.005913 | 0.000045 |
| Decision Tree | 1,632 | 0.011190 | 0.000039 |
| Decision Tree | 3,263 | 0.033283 | 0.000057 |
| KNN | 327 | 0.000034 | 0.005613 |
| KNN | 817 | 0.000115 | 0.031201 |
| KNN | 1,632 | 0.000166 | 0.047061 |
| KNN | 3,263 | 0.000364 | 0.075309 |

Observations:

- Decision Tree training time increased as the training dataset grew.
- Decision Tree prediction remained very fast, with small variations between measurements.
- KNN training time remained comparatively low.
- KNN prediction time increased substantially with training-data size.
- These observations broadly align with the expected behaviour of both algorithms.
- All configurations used the same 816 test records.

### Memory measurement limitation

Memory usage was not returned by the backend (`memoryBytes: null`) and is therefore reported as unavailable rather than estimated.

### Evidence files

- `complexity_results_A3.csv`
- `complexity_training.png`
- `complexity_prediction.png`
- `plot_complexity.py`

## 5. Definition of done

- Every test builds and passes with the commands in this file, on a fresh clone.
- Every item in section 3 was tried and the result is written down.
- Experiment results are saved in the repo and used in the report.