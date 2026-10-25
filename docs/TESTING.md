# Testing Guide (DRAFT)

Owner: Member 4 (Integration and Testing).

## 1. Run the existing data tests

From the project root:

```bash
g++ -std=c++17 -Wall -Wextra -Iinclude tests/testdata.cpp src/data/cleaner.cpp src/data/csv_loader.cpp src/data/dataset.cpp src/data/preprocessor.cpp -o test_data
./test_data
```
On Windows PowerShell, run `.\test_data.exe` instead of `./test_data`.
Expected last line: `All data-layer tests passed`.

## 2. Tests still to write (Member 4)

| Test file | What it checks | Run it with (planned) |
|---|---|---|
| `tests/testmodels.cpp` (done) | Decision Tree, KNN and `evaluate()` on tiny hand-made data with known answers; bad input gives clear errors | see section 2a |
| `tests/testpipeline.cpp` (done) | Whole chain on `data/sample_A2.csv`: clean, split, scale, train both models, predict, metrics. Checks the split, no leakage, same seed gives same split, both models beat a lazy baseline, and a second file (`sample_B.csv`) works | see section 2b |
| `tests/testbadinput.cpp` | Bad input in section 3 gives a clear error, not a crash | same |

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

1. Use the same prepared sample for both models, with a fixed seed.
2. Row counts: 1,000, 5,000, 10,000, 25,000, 50,000 (lower if KNN is too slow).
3. For each size and model, record training time and prediction time. Run 3 times and take the average.
4. Save results as a CSV: `model,rows,trainSeconds,predictSeconds`.
5. Plot time against size and compare with the theory (Decision Tree about n log n to train, KNN about n per prediction).
6. Write down the computer used (CPU and RAM) next to the results.

## 5. Definition of done

- Every test builds and passes with the commands in this file, on a fresh clone.
- Every item in section 3 was tried and the result is written down.
- Experiment results are saved in the repo and used in the report.