// Plain-assert tests (no framework). Build target: test_data. Run: ./test_data
#include <cmath>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <set>
#include "preprocessor.h"

static int failures = 0;
#define CHECK(cond) do { if (!(cond)) { ++failures; std::cout << "FAIL line " << __LINE__ << ": " #cond "\n"; } } while (0)

static Dataset makeDs(const std::vector<std::vector<double>>& X, const std::vector<int>& y, size_t nFeat) {
    Dataset d; d.X = X; d.y = y; d.classNames = defaultClassNames();
    for (size_t j = 0; j < nFeat; ++j) d.featureNames.push_back("f" + std::to_string(j));
    return d;
}

static void writeFile(const std::string& path, const std::string& text) { std::ofstream(path) << text; }

static void testLabels() {
    CHECK(encodeLabel("BENIGN") == 0);
    CHECK(encodeLabel(" benign ") == 0);
    CHECK(encodeLabel("DoS Hulk") == 1);
    CHECK(encodeLabel("DDoS") == 1);
    CHECK(encodeLabel("PortScan") == 2);
    CHECK(encodeLabel("SSH-Patator") == 3);
    CHECK(encodeLabel("FTP-Patator") == 3);
    CHECK(encodeLabel("Bot") == -1);
    CHECK(encodeLabel("") == -1);
}

static void testUnknownLabelAndValidate() {
    LoadResult lr; lr.featureNames = {"a", "b"};
    lr.records = {{{1, 2}, "BENIGN"}, {{3, 4}, "Heartbleed"}, {{5, 6}, "PortScan"}};
    size_t unknown = 0;
    Dataset ds = toDataset(lr, &unknown);
    CHECK(unknown == 1); CHECK(ds.X.size() == 2); CHECK(validateDataset(ds).empty());
    ds.X[0].push_back(9);              CHECK(!validateDataset(ds).empty());   // ragged row
    ds.X[0].pop_back(); ds.y[0] = 9;   CHECK(!validateDataset(ds).empty());   // label out of range
    ds.y[0] = 0; ds.X[0][0] = NAN;     CHECK(!validateDataset(ds).empty());   // NaN
    ds.X[0][0] = 1; ds.y.pop_back();   CHECK(!validateDataset(ds).empty());   // size mismatch
}

static void testDuplicates() {
    Dataset ds = makeDs({{1, 2}, {1, 2}, {1, 2}, {3, 4}}, {0, 0, 1, 2}, 2);
    CHECK(countConflictingFeatures(ds) == 1);   // {1,2} has labels 0 and 1
    CHECK(removeDuplicates(ds) == 1);           // only the exact repeat goes
    CHECK(ds.X.size() == 3);
    CHECK(classCounts(ds) == (std::vector<size_t>{1, 1, 1, 0}));
}

static Dataset bigDs() {
    Dataset d = makeDs({}, {}, 3);
    for (int i = 0; i < 400; ++i) { d.X.push_back({double(i), double(i % 7), 5.0}); d.y.push_back(i < 300 ? 0 : (i < 350 ? 1 : (i < 390 ? 2 : 3))); }
    return d;
}

static void testSplit() {
    Dataset d = bigDs();
    SplitResult a = stratifiedSplit(d, 0.25, 7), b = stratifiedSplit(d, 0.25, 7), c = stratifiedSplit(d, 0.25, 8);
    CHECK(a.train.X == b.train.X && a.test.X == b.test.X);       // same seed -> identical
    CHECK(a.test.X != c.test.X);                                  // different seed -> different
    CHECK(a.train.X.size() + a.test.X.size() == d.X.size());
    CHECK(classCounts(a.test) == (std::vector<size_t>{75, 13, 10, 3}) || classCounts(a.test)[0] == 75);
    std::set<double> trainIds; for (auto& r : a.train.X) trainIds.insert(r[0]);
    bool overlap = false; for (auto& r : a.test.X) if (trainIds.count(r[0])) overlap = true;
    CHECK(!overlap);
    for (size_t k : classCounts(a.train)) CHECK(k > 0);
    for (size_t k : classCounts(a.test)) CHECK(k > 0);
    bool threw = false; try { stratifiedSplit(d, 1.5); } catch (const std::invalid_argument&) { threw = true; }
    CHECK(threw);
}

static void testScalerNoLeak() {
    Dataset train = makeDs({{0}, {2}, {4}}, {0, 0, 0}, 1), test = makeDs({{10}}, {0}, 1);
    Scaler s; s.fit(train, false); s.transform(train); s.transform(test);
    double m = (train.X[0][0] + train.X[1][0] + train.X[2][0]) / 3;
    CHECK(std::fabs(m) < 1e-9);
    double sd = std::sqrt(8.0 / 3.0);                       // train mean 2, std sqrt(8/3)
    CHECK(std::fabs(test.X[0][0] - (10 - 2) / sd) < 1e-9);  // test uses TRAIN statistics
}

static void testScalerBinaryAndLog() {
    // col0 binary flag (must stay 0/1), col1 skewed non-negative (log applied), col2 has negatives (no log)
    Dataset train = makeDs({{0, 1, -1}, {1, 10, 0}, {0, 100, 1}, {1, 1000, 2}}, {0, 1, 0, 1}, 3);
    Dataset test = makeDs({{1, -5, 9}}, {0}, 3);
    Scaler s; s.fit(train, true); s.transform(train); s.transform(test);
    CHECK(train.X[0][0] == 0.0 && train.X[1][0] == 1.0);                     // binary untouched
    double m = 0; for (auto& r : train.X) m += r[1]; CHECK(std::fabs(m / 4) < 1e-9);   // z-scored after log
    CHECK(train.X[3][1] < 2.0);                                              // outlier tamed vs raw z-score
    double l = std::log1p(0.0), lm = (std::log1p(1) + std::log1p(10) + std::log1p(100) + std::log1p(1000)) / 4;
    double ls = 0; for (double v : {1.0, 10.0, 100.0, 1000.0}) ls += (std::log1p(v) - lm) * (std::log1p(v) - lm);
    ls = std::sqrt(ls / 4);
    CHECK(std::fabs(test.X[0][1] - (l - lm) / ls) < 1e-9);                   // negative test value clamped to 0
    CHECK(test.X[0][0] == 1.0);
}

static void testSelector() {
    Dataset d = makeDs({}, {}, 4);
    for (int i = 0; i < 200; ++i) {
        int cls = i % 2;
        double signal = cls * 10 + (i % 5) * 0.1;
        d.X.push_back({signal, 3.0, signal * 2 + 1, double((i * 37) % 11)});   // f1 constant, f2 = 2*f0+1
        d.y.push_back(cls);
    }
    FeatureSelector fs; fs.fit(d, 0, 0.95);
    CHECK(fs.droppedConstant == 1);
    CHECK(fs.droppedCorrelated == 1);
    CHECK(fs.kept().size() == 2);
    FeatureSelector fs1; fs1.fit(d, 1, 0.95);
    CHECK(fs1.kept().size() == 1);
    Dataset copy = d; fs.apply(copy);
    CHECK(copy.featureNames.size() == 2 && copy.X[0].size() == 2);
}

static void testOneHot() {
    Dataset train = makeDs({{6, 1}, {17, 2}, {6, 3}}, {0, 0, 0}, 2);
    Dataset test = makeDs({{99, 4}, {17, 5}}, {0, 0}, 2);            // 99 never seen in train
    train.featureNames[0] = " Protocol"; test.featureNames[0] = " Protocol";
    OneHotEncoder enc; enc.fit(train, {"Protocol", "Nope"});
    enc.transform(train); enc.transform(test);
    CHECK(train.featureNames.size() == 3 && train.featureNames[1] == "Protocol=6");
    CHECK(train.X[0] == (std::vector<double>{1, 1, 0}));
    CHECK(train.X[1] == (std::vector<double>{2, 0, 1}));
    CHECK(test.X[0] == (std::vector<double>{4, 0, 0}));              // unseen category -> all zeros
    CHECK(test.X[1] == (std::vector<double>{5, 0, 1}));
    CHECK(test.featureNames == train.featureNames);                  // same dimensions as train
}

static void testCsv() {
    writeFile("t_bad.csv",
        "a,b,Label\n"
        "1,2,BENIGN\n"        // good
        "1,2abc,BENIGN\n"     // trailing junk
        "NaN,2,BENIGN\n"      // NaN
        "inf,2,DoS\n"         // infinity
        "1,2\n"               // wrong column count
        "7,8,Heartbleed\n"    // unknown label
        "9,9,PortScan\n");    // good
    CleanReport rep; Dataset ds = loadAndClean("t_bad.csv", &rep);
    CHECK(ds.X.size() == 2); CHECK(rep.skippedInvalid == 4); CHECK(rep.unknownLabel == 1);

    writeFile("t_empty.csv", "a,b,Label\n");                     // valid, zero rows
    Dataset e = loadAndClean("t_empty.csv"); CHECK(e.X.empty());

    bool threw = false;                                            // failure is distinguishable
    try { loadAndClean("does_not_exist.csv"); } catch (const std::runtime_error&) { threw = true; }
    CHECK(threw);
    std::remove("t_bad.csv"); std::remove("t_empty.csv");
}

static void writeSyntheticCsv(const std::string& path, int from, int to, const std::string& header = "a,b,c,Label") {
    const char* labels[4] = {"BENIGN", "DoS Hulk", "PortScan", "SSH-Patator"};
    std::ofstream f(path);
    f << header << "\n";
    for (int i = from; i < to; ++i) {
        int cls = i % 4;
        f << i << "," << (i * 7) % 13 + cls * 3 << "," << i % 5 << "," << labels[cls] << "\n";
    }
}

static void testColumnHelpers() {
    Dataset d = makeDs({{1, 2, 3}, {4, 5, 6}}, {0, 1}, 3);
    d.featureNames = {" Alpha", "Beta", "Gamma"};
    Dataset k = d; keepColumns(k, {"gamma", "alpha"});
    CHECK(k.featureNames == (std::vector<std::string>{" Alpha", "Gamma"}));          // original order kept
    CHECK(k.X[1] == (std::vector<double>{4, 6}));
    Dataset r = d; removeColumns(r, {"BETA"});
    CHECK(r.featureNames.size() == 2 && r.X[0] == (std::vector<double>{1, 3}));
    bool t1 = false, t2 = false, t3 = false;
    try { keepColumns(d, {"Nope"}); } catch (const std::invalid_argument&) { t1 = true; }
    try { removeColumns(d, {"Nope"}); } catch (const std::invalid_argument&) { t2 = true; }
    try { removeColumns(d, {"Alpha", "Beta", "Gamma"}); } catch (const std::invalid_argument&) { t3 = true; }
    CHECK(t1 && t2 && t3);
}

static void testPrepareOptionsAndPrepareLike() {
    writeSyntheticCsv("t_train.csv", 0, 240);
    writeSyntheticCsv("t_other.csv", 240, 320);

    PrepareOptions opt; opt.maxFeatures = 0;
    PreparedData base = prepareDataset("t_train.csv", opt);
    CHECK(base.train.featureNames.size() >= 2);

    PrepareOptions dropA = opt; dropA.dropColumns = {"a"};
    PreparedData pd = prepareDataset("t_train.csv", dropA);
    for (const auto& n : pd.train.featureNames) CHECK(n != "a");
    CHECK(pd.train.X[0].size() == pd.train.featureNames.size());

    PrepareOptions onlyB = opt; onlyB.keepOnlyColumns = {"b"};
    PreparedData pb = prepareDataset("t_train.csv", onlyB);
    CHECK(pb.train.featureNames == (std::vector<std::string>{"b"}));
    CHECK(pb.test.featureNames == pb.train.featureNames);

    bool threw = false;
    PrepareOptions bad = opt; bad.dropColumns = {"zzz"};
    try { prepareDataset("t_train.csv", bad); } catch (const std::invalid_argument&) { threw = true; }
    CHECK(threw);

    // prepareLike: a file with the same columns is prepared exactly like the training data
    Dataset other = prepareLike(base, "t_other.csv");
    CHECK(other.featureNames == base.train.featureNames);
    CHECK(other.X.size() == 80);
    // preparing the training csv itself must reproduce every test row of the split exactly
    Dataset again = prepareLike(base, "t_train.csv");
    std::set<std::vector<double>> rows(again.X.begin(), again.X.end());
    bool allFound = true;
    for (const auto& r : base.test.X) if (!rows.count(r)) allFound = false;
    CHECK(allFound);
    // same with keep/drop options
    Dataset otherB = prepareLike(pb, "t_other.csv");
    CHECK(otherB.featureNames == (std::vector<std::string>{"b"}));

    // different columns -> error
    writeSyntheticCsv("t_wrong.csv", 0, 40, "a,b,zzz,Label");
    threw = false;
    try { prepareLike(base, "t_wrong.csv"); } catch (const std::runtime_error&) { threw = true; }
    CHECK(threw);
    std::remove("t_train.csv"); std::remove("t_other.csv"); std::remove("t_wrong.csv");
}

int main() {
    testLabels(); testUnknownLabelAndValidate(); testDuplicates(); testSplit();
    testScalerNoLeak(); testScalerBinaryAndLog(); testSelector(); testOneHot(); testCsv();
    testColumnHelpers(); testPrepareOptionsAndPrepareLike();
    std::cout << (failures ? "FAILED\n" : "All data-layer tests passed\n");
    return failures ? 1 : 0;
}