// Plain-assert tests for the models and the metrics code (no test library needed).
// Same style as tests/testdata.cpp.
// Build target: test_models. Run: ./test_models  (Windows: .\test_models.exe)
//
// How to read a test: each CHECK(...) asks one yes/no question. If the answer is "no",
// the program prints FAIL and the line number, and the test run ends with an error code.
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <vector>
#include "decision_tree.h"
#include "eval_utils.h"
#include "knn.h"

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { ++failures; std::cout << "FAIL line " << __LINE__ << ": " #cond "\n"; } } while (0)
// CHECK_THROWS(code, ExceptionType): passes only if the code throws that kind of error.
#define CHECK_THROWS(code, ExType) do { bool ok_ = false; \
    try { code; } catch (const ExType&) { ok_ = true; } catch (...) {} \
    if (!ok_) { ++failures; std::cout << "FAIL line " << __LINE__ << ": expected " #ExType " from " #code "\n"; } } while (0)

static bool near(double a, double b) { return std::fabs(a - b) < 1e-9; }

// Builds a tiny Dataset by hand, so we know the right answer in advance.
static Dataset makeDs(const std::vector<std::vector<double>>& X, const std::vector<int>& y) {
    Dataset d;
    d.X = X;
    d.y = y;
    d.classNames = defaultClassNames();   // BENIGN, DoS, PortScan, BruteForce
    if (!X.empty())
        for (size_t j = 0; j < X[0].size(); ++j) d.featureNames.push_back("f" + std::to_string(j));
    return d;
}

// Three clearly separated groups of points: class 0 near (0,0), class 1 near (10,10), class 2 near (0,10).
static Dataset clusters() {
    return makeDs({{0, 0}, {0.5, 0}, {0, 0.5}, {0.5, 0.5},
                   {10, 10}, {10.5, 10}, {10, 10.5}, {10.5, 10.5},
                   {0, 10}, {0.5, 10}, {0, 10.5}, {0.5, 10.5}},
                  {0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2});
}

// ---------------------------------------------------------------- KNN

// A point that sits inside a group should get that group's class.
static void testKnnClusters() {
    KnnOptions opt; opt.k = 3;
    KNN knn(opt);
    knn.fit(clusters());
    CHECK(knn.predict({0.2, 0.2}) == 0);
    CHECK(knn.predict({10.2, 10.2}) == 1);
    CHECK(knn.predict({0.2, 10.2}) == 2);
    // Manhattan distance (p = 1) must give the same answers on such clear groups.
    KnnOptions m; m.k = 3; m.p = 1.0;
    KNN knn1(m);
    knn1.fit(clusters());
    CHECK(knn1.predict({0.2, 0.2}) == 0);
    CHECK(knn1.predict({10.2, 10.2}) == 1);
}

// With k = 1 the answer is simply the label of the single closest training row.
static void testKnnK1() {
    KnnOptions opt; opt.k = 1;
    KNN knn(opt);
    knn.fit(makeDs({{0}, {10}}, {1, 2}));
    CHECK(knn.predict({1}) == 1);
    CHECK(knn.predict({9}) == 2);
}

// If k is bigger than the training set, KNN just uses all rows (it must not crash).
static void testKnnKLargerThanData() {
    KnnOptions opt; opt.k = 100;
    KNN knn(opt);
    knn.fit(makeDs({{0}, {1}, {2}, {3}, {50}, {51}}, {0, 0, 0, 0, 1, 1}));
    CHECK(knn.predict({50}) == 0);   // 4 votes for class 0 beat 2 votes for class 1
}

// Plain voting counts heads. Distance-weighted voting lets a very close neighbour count more.
static void testKnnWeighted() {
    Dataset d = makeDs({{0.1}, {5.0}, {5.1}}, {1, 0, 0});
    KnnOptions plain; plain.k = 3;
    KNN a(plain); a.fit(d);
    CHECK(a.predict({0.0}) == 0);    // two far votes for class 0 win
    KnnOptions weighted; weighted.k = 3; weighted.distanceWeighted = true;
    KNN b(weighted); b.fit(d);
    CHECK(b.predict({0.0}) == 1);    // the one very close neighbour wins
}

// Tie rules written in knn.cpp: equal votes -> smaller summed distance wins;
// still equal -> lower class index wins.
static void testKnnTies() {
    KnnOptions opt; opt.k = 2;
    KNN a(opt);
    a.fit(makeDs({{1}, {-2}}, {0, 1}));     // distances 1 and 2 from the query 0
    CHECK(a.predict({0}) == 0);
    KNN b(opt);
    b.fit(makeDs({{1}, {-1}}, {1, 0}));     // both distance 1: lower class index (0) wins
    CHECK(b.predict({0}) == 0);
}

static void testKnnPredictAll() {
    KnnOptions opt; opt.k = 3;
    KNN knn(opt);
    knn.fit(clusters());
    std::vector<std::vector<double>> q = {{0.2, 0.2}, {10.2, 10.2}, {0.2, 10.2}};
    std::vector<int> all = knn.predictAll(q);
    CHECK(all.size() == 3);
    CHECK(all[0] == 0 && all[1] == 1 && all[2] == 2);
    CHECK(knn.predictAll({}).empty());
}

// Wrong use must give a clear error, not a crash or a silent wrong answer.
static void testKnnBadInput() {
    KNN knn;
    CHECK_THROWS(knn.fit(makeDs({}, {})), std::invalid_argument);                  // empty data
    CHECK_THROWS(knn.fit(makeDs({{1}, {2}}, {0})), std::invalid_argument);         // X and y differ in size
    CHECK_THROWS(knn.fit(makeDs({{1, 2}, {3}}, {0, 1})), std::invalid_argument);   // rows of different width
    CHECK_THROWS(knn.fit(makeDs({{1}}, {-1})), std::invalid_argument);             // negative class
    CHECK_THROWS(knn.predict({1.0}), std::runtime_error);                          // predict before fit
    KnnOptions k0; k0.k = 0;
    CHECK_THROWS(KNN(k0).fit(clusters()), std::invalid_argument);                  // k = 0
    KnnOptions p0; p0.p = 0.5;
    CHECK_THROWS(KNN(p0).fit(clusters()), std::invalid_argument);                  // p < 1
    knn.fit(clusters());
    CHECK_THROWS(knn.predict({1.0}), std::invalid_argument);                       // wrong number of features
}

// ------------------------------------------------------- Decision Tree

// One feature, one clear rule: x <= 5 is class 0, otherwise class 1. The tree needs 1 split.
static void testTreeSimpleRule() {
    Dataset d = makeDs({{1}, {2}, {3}, {4}, {7}, {8}, {9}, {10}}, {0, 0, 0, 0, 1, 1, 1, 1});
    DecisionTree t;
    t.fit(d);
    CHECK(t.predictAll(d.X) == d.y);            // it gets every training row right
    CHECK(t.predict({0.0}) == 0);
    CHECK(t.predict({100.0}) == 1);
    CHECK(t.depth() == 1);
    CHECK(t.nodeCount() == 3);                  // 1 root + 2 leaves
    CHECK(t.leafCount() == 2);
}

// If every row has the same class there is nothing to split: just one leaf.
static void testTreePureData() {
    DecisionTree t;
    t.fit(makeDs({{1}, {2}, {3}}, {2, 2, 2}));
    CHECK(t.nodeCount() == 1);
    CHECK(t.depth() == 0);
    CHECK(t.predict({99}) == 2);
}

// maxDepth is a hard limit. Three groups on one line need depth 2 when unlimited.
static void testTreeMaxDepth() {
    Dataset d = makeDs({{1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9}}, {0, 0, 0, 1, 1, 1, 2, 2, 2});
    TreeOptions limited; limited.maxDepth = 1;
    DecisionTree a(limited); a.fit(d);
    CHECK(a.depth() == 1);
    CHECK(a.predictAll(d.X) != d.y);            // one split cannot separate three groups
    TreeOptions open; open.maxDepth = 0;        // 0 = unlimited
    DecisionTree b(open); b.fit(d);
    CHECK(b.depth() == 2);
    CHECK(b.predictAll(d.X) == d.y);
}

// minSamplesLeaf = 3 needs at least 6 rows to split. With 4 rows the tree stays a single leaf.
static void testTreeMinSamplesLeaf() {
    TreeOptions opt; opt.minSamplesLeaf = 3;
    DecisionTree t(opt);
    t.fit(makeDs({{1}, {2}, {8}, {9}}, {0, 0, 1, 1}));
    CHECK(t.nodeCount() == 1);
}

// Only feature 0 decides the class. Feature 1 is the same for every row, so it is useless.
static void testTreeFeatureImportance() {
    Dataset d = makeDs({{1, 5}, {2, 5}, {3, 5}, {8, 5}, {9, 5}, {10, 5}}, {0, 0, 0, 1, 1, 1});
    DecisionTree t;
    t.fit(d);
    std::vector<double> imp = t.featureImportance();
    CHECK(imp.size() == 2);
    CHECK(near(imp[0], 1.0));
    CHECK(near(imp[1], 0.0));
    CHECK(near(imp[0] + imp[1], 1.0));          // the shares always add up to 1
}

// Two identical rows with different labels cannot be separated. The rule says: lower class index.
static void testTreeTie() {
    DecisionTree t;
    t.fit(makeDs({{1}, {1}}, {2, 1}));
    CHECK(t.predict({1}) == 1);
}

static void testTreePredictAll() {
    DecisionTree t;
    t.fit(clusters());
    std::vector<int> all = t.predictAll({{0.2, 0.2}, {10.2, 10.2}, {0.2, 10.2}});
    CHECK(all.size() == 3);
    CHECK(all[0] == 0 && all[1] == 1 && all[2] == 2);
    CHECK(t.predictAll({}).empty());
}

static void testTreeBadInput() {
    DecisionTree t;
    CHECK_THROWS(t.fit(makeDs({}, {})), std::invalid_argument);
    CHECK_THROWS(t.fit(makeDs({{1}, {2}}, {0})), std::invalid_argument);
    CHECK_THROWS(t.fit(makeDs({{1, 2}, {3}}, {0, 1})), std::invalid_argument);
    CHECK_THROWS(t.fit(makeDs({{1}}, {-1})), std::invalid_argument);
    CHECK_THROWS(t.predict({1.0}), std::runtime_error);                            // predict before fit
    TreeOptions bad; bad.minSamplesLeaf = 0;
    CHECK_THROWS(DecisionTree(bad).fit(clusters()), std::invalid_argument);
    t.fit(clusters());
    CHECK_THROWS(t.predict({1.0}), std::invalid_argument);                         // wrong number of features
}

// -------------------------------------------------- Metrics (evaluate)

// A small example worked out by hand.
//   truth = 0 0 0 0 1 1 2 2     pred = 0 0 0 1 1 1 2 0
// Confusion matrix (rows = truth, columns = predicted):
//        pred0 pred1 pred2
//   t0     3     1     0
//   t1     0     2     0
//   t2     1     0     1
static void testMetricsByHand() {
    using evalutil::Metrics;
    Metrics m = evalutil::evaluate({0, 0, 0, 0, 1, 1, 2, 2}, {0, 0, 0, 1, 1, 1, 2, 0}, 3);
    CHECK(m.confusion[0] == (std::vector<int>{3, 1, 0}));
    CHECK(m.confusion[1] == (std::vector<int>{0, 2, 0}));
    CHECK(m.confusion[2] == (std::vector<int>{1, 0, 1}));
    CHECK(near(m.accuracy, 6.0 / 8.0));                       // 6 right out of 8
    CHECK(near(m.recall[0], 0.75));  CHECK(near(m.recall[1], 1.0));  CHECK(near(m.recall[2], 0.5));
    CHECK(near(m.precision[0], 0.75)); CHECK(near(m.precision[1], 2.0 / 3.0)); CHECK(near(m.precision[2], 1.0));
    CHECK(near(m.macroF1, (0.75 + 0.8 + 2.0 / 3.0) / 3.0));   // average of the three class F1 scores
    // Normal / attack view (class 0 = normal):
    CHECK(m.benignCount == 4);
    CHECK(m.falseAlarms == 1);                                // one normal flow flagged as attack
    CHECK(near(m.fpr, 0.25));
    CHECK(near(m.detectionRate, 0.75));                       // 3 of 4 attacks flagged as some attack
    CHECK(m.flagged == 4);
    CHECK(near(m.alertPrecision, 0.75));                      // 3 of the 4 alerts were real attacks
}

static void testMetricsEdgeCases() {
    using evalutil::Metrics;
    Metrics perfect = evalutil::evaluate({0, 1, 2, 3}, {0, 1, 2, 3}, 4);
    CHECK(near(perfect.accuracy, 1.0));
    CHECK(near(perfect.macroF1, 1.0));
    CHECK(near(perfect.fpr, 0.0));
    Metrics empty = evalutil::evaluate({}, {}, 4);              // nothing to score: no crash, accuracy 0
    CHECK(near(empty.accuracy, 0.0));
    CHECK_THROWS(evalutil::evaluate({0, 1}, {0}, 4), std::invalid_argument);     // lists differ in length
    CHECK_THROWS(evalutil::evaluate({0, 9}, {0, 1}, 4), std::out_of_range);      // class number too big
    CHECK_THROWS(evalutil::evaluate({0, -1}, {0, 1}, 4), std::out_of_range);     // negative class number
}

// The same checker is used for both models. Check that both reach the same score on easy data.
static void testBothModelsSameScorer() {
    Dataset d = clusters();
    KnnOptions o; o.k = 3;
    KNN knn(o); knn.fit(d);
    DecisionTree tree; tree.fit(d);
    evalutil::Metrics a = evalutil::evaluate(d.y, knn.predictAll(d.X), 4);
    evalutil::Metrics b = evalutil::evaluate(d.y, tree.predictAll(d.X), 4);
    CHECK(near(a.accuracy, 1.0));
    CHECK(near(b.accuracy, 1.0));
}

int main() {
    testKnnClusters();
    testKnnK1();
    testKnnKLargerThanData();
    testKnnWeighted();
    testKnnTies();
    testKnnPredictAll();
    testKnnBadInput();
    testTreeSimpleRule();
    testTreePureData();
    testTreeMaxDepth();
    testTreeMinSamplesLeaf();
    testTreeFeatureImportance();
    testTreeTie();
    testTreePredictAll();
    testTreeBadInput();
    testMetricsByHand();
    testMetricsEdgeCases();
    testBothModelsSameScorer();
    if (failures == 0) { std::cout << "All model and metrics tests passed\n"; return 0; }
    std::cout << failures << " check(s) FAILED\n";
    return 1;
}
