// End-to-end ("pipeline") test: CSV file -> clean -> split -> scale -> train both models -> predict -> metrics.
// This checks that Member 1's data layer and Member 2's models work TOGETHER, on real sample data.
// Build target: test_pipeline.  Run it from the project root (it reads data/sample_A2.csv and data/sample_B.csv).
// Windows: .\test_pipeline.exe
#include <cmath>
#include <iostream>
#include <vector>
#include "decision_tree.h"
#include "eval_utils.h"
#include "knn.h"
#include "preprocessor.h"

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { ++failures; std::cout << "FAIL line " << __LINE__ << ": " #cond "\n"; } } while (0)

static const char* kMain = "data/sample_A2.csv";   // 3000 flows: 1500 BENIGN + attacks
static const char* kExtra = "data/sample_B.csv";   // a different file, same columns (used like a "new day" of traffic)

static bool hasNan(const Dataset& d) {
    for (const auto& row : d.X) for (double v : row) if (std::isnan(v) || std::isinf(v)) return true;
    return false;
}

// Share of the biggest class = the score of a lazy model that always answers the same class.
static double lazyBaseline(const std::vector<int>& y) {
    std::vector<int> count(4, 0);
    for (int c : y) if (c >= 0 && c < 4) ++count[c];
    int best = 0;
    for (int c : count) if (c > best) best = c;
    return y.empty() ? 0.0 : static_cast<double>(best) / static_cast<double>(y.size());
}

// 1. The data layer hands over sane data.
static void testPreparedDataLooksRight(const PreparedData& p) {
    CHECK(!p.train.X.empty());
    CHECK(!p.test.X.empty());
    CHECK(p.train.X.size() == p.train.y.size());
    CHECK(p.test.X.size() == p.test.y.size());
    // About 80% / 20% split (the default test fraction is 0.2).
    double total = static_cast<double>(p.train.X.size() + p.test.X.size());
    double testShare = static_cast<double>(p.test.X.size()) / total;
    CHECK(testShare > 0.15 && testShare < 0.25);
    // Train and test must use the very same feature columns, or the models could not be compared fairly.
    CHECK(p.train.X[0].size() == p.test.X[0].size());
    CHECK(p.train.featureNames == p.test.featureNames);
    CHECK(!hasNan(p.train));
    CHECK(!hasNan(p.test));
    // Every one of the 4 classes appears on both sides of the split (stratified split).
    std::vector<size_t> trainCounts = classCounts(p.train), testCounts = classCounts(p.test);
    for (size_t c = 0; c < 4; ++c) { CHECK(trainCounts[c] > 0); CHECK(testCounts[c] > 0); }
}

// 2. No leakage: the scaler learns from TRAIN only, so each non-binary train column has mean ~ 0.
static void testScalerUsesTrainOnly(const PreparedData& p) {
    const auto& mean = p.scaler.mean();
    CHECK(!mean.empty());
    // The scaler stored the train means; recompute from the final train columns for the z-scored ones.
    size_t checkedColumns = 0;
    for (size_t j = 0; j < p.train.X[0].size(); ++j) {
        bool binary = true;
        for (const auto& row : p.train.X) if (row[j] != 0.0 && row[j] != 1.0) { binary = false; break; }
        if (binary) continue;
        double sum = 0;
        for (const auto& row : p.train.X) sum += row[j];
        CHECK(std::fabs(sum / static_cast<double>(p.train.X.size())) < 1e-6);
        ++checkedColumns;
    }
    CHECK(checkedColumns > 0);
}

// 3. Same seed = same split (so everybody on the team gets the same numbers).
static void testSplitIsReproducible(const PreparedData& p) {
    PreparedData again = prepareDataset(kMain);
    CHECK(again.train.X.size() == p.train.X.size());
    CHECK(again.test.X.size() == p.test.X.size());
    CHECK(again.train.y == p.train.y);
    CHECK(again.test.y == p.test.y);
}

// 4. Both models, same test set, same scorer. They must beat the lazy "always the biggest class" model.
static void testBothModelsOnSameData(const PreparedData& p) {
    double lazy = lazyBaseline(p.test.y);

    KnnOptions ko;                       // default settings
    KNN knn(ko);
    knn.fit(p.train);
    std::vector<int> knnPred = knn.predictAll(p.test.X);

    DecisionTree tree;                   // default settings
    tree.fit(p.train);
    std::vector<int> treePred = tree.predictAll(p.test.X);

    // One prediction per test row, for both models.
    CHECK(knnPred.size() == p.test.y.size());
    CHECK(treePred.size() == p.test.y.size());

    evalutil::Metrics mk = evalutil::evaluate(p.test.y, knnPred, 4);
    evalutil::Metrics mt = evalutil::evaluate(p.test.y, treePred, 4);
    std::cout << "  lazy baseline " << lazy << " | KNN accuracy " << mk.accuracy
              << " | Tree accuracy " << mt.accuracy << "\n";
    CHECK(mk.accuracy > lazy + 0.2);
    CHECK(mt.accuracy > lazy + 0.2);
    CHECK(mk.accuracy <= 1.0 && mt.accuracy <= 1.0);

    // The confusion matrix must add up to the number of test rows (nothing lost, nothing counted twice).
    size_t cellsK = 0, cellsT = 0;
    for (const auto& row : mk.confusion) for (int v : row) cellsK += static_cast<size_t>(v);
    for (const auto& row : mt.confusion) for (int v : row) cellsT += static_cast<size_t>(v);
    CHECK(cellsK == p.test.y.size());
    CHECK(cellsT == p.test.y.size());

    // Same input, same answer: predictions must not change from run to run.
    CHECK(knn.predictAll(p.test.X) == knnPred);
    CHECK(tree.predictAll(p.test.X) == treePred);
}

// 5. A second CSV is prepared "like" the training data and the trained models can score it.
static void testSecondFileWithPrepareLike(const PreparedData& p) {
    Dataset extra = prepareLike(p, kExtra);
    CHECK(!extra.X.empty());
    CHECK(extra.X[0].size() == p.train.X[0].size());   // same columns as the training data
    CHECK(!hasNan(extra));
    DecisionTree tree;
    tree.fit(p.train);
    std::vector<int> pred = tree.predictAll(extra.X);
    CHECK(pred.size() == extra.y.size());
    evalutil::Metrics m = evalutil::evaluate(extra.y, pred, 4);
    std::cout << "  extra file (sample_B) Tree accuracy " << m.accuracy << "\n";
    CHECK(m.accuracy > 0.5);
}

int main() {
    PreparedData p;
    try {
        p = prepareDataset(kMain);
    } catch (const std::exception& e) {
        std::cout << "Could not prepare " << kMain << ": " << e.what()
                  << "\nRun this test from the project root folder.\n";
        return 1;
    }
    testPreparedDataLooksRight(p);
    testScalerUsesTrainOnly(p);
    testSplitIsReproducible(p);
    testBothModelsOnSameData(p);
    testSecondFileWithPrepareLike(p);
    if (failures == 0) { std::cout << "All pipeline tests passed\n"; return 0; }
    std::cout << failures << " check(s) FAILED\n";
    return 1;
}
