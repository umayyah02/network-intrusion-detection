// Tunes KNN with stratified k-fold cross-validation INSIDE p.train only.
// p.test is never touched in tune mode; it is used once, in "final" mode.
//
//   ./tune_knn data/sample_1000.csv                       -> grid search (CV on train)
//   ./tune_knn data/sample_1000.csv final 1 5 0 0         -> one evaluation on test
//                                         p K weighted dropPort   (weighted, dropPort: 0 or 1)
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <random>
#include <string>
#include <utility>
#include <vector>

#include "knn.h"
#include "preprocessor.h"

using namespace std;

namespace {

const char* kPortName = "Destination Port";

// ---------- metrics ----------
struct Metrics {
    double accuracy = 0, macroF1 = 0;
    double fpr = 0;            // benign predicted as malicious / all benign
    double detectionRate = 0;  // malicious predicted as malicious / all malicious
    vector<double> recall, precision;
    vector<vector<int>> confusion;  // [true][predicted]
};

Metrics evaluate(const vector<int>& truth, const vector<int>& pred, size_t nClasses) {
    Metrics m;
    m.confusion.assign(nClasses, vector<int>(nClasses, 0));
    for (size_t i = 0; i < truth.size(); ++i) m.confusion[truth[i]][pred[i]]++;

    vector<int> row(nClasses, 0), col(nClasses, 0);
    int correct = 0;
    for (size_t t = 0; t < nClasses; ++t)
        for (size_t p = 0; p < nClasses; ++p) {
            row[t] += m.confusion[t][p];
            col[p] += m.confusion[t][p];
            if (t == p) correct += m.confusion[t][p];
        }

    m.accuracy = truth.empty() ? 0.0 : static_cast<double>(correct) / truth.size();
    m.recall.assign(nClasses, 0.0);
    m.precision.assign(nClasses, 0.0);
    double f1Sum = 0;
    int present = 0;
    for (size_t c = 0; c < nClasses; ++c) {
        const double tp = m.confusion[c][c];
        m.recall[c] = row[c] > 0 ? tp / row[c] : 0.0;
        m.precision[c] = col[c] > 0 ? tp / col[c] : 0.0;
        const double s = m.precision[c] + m.recall[c];
        if (row[c] > 0) {
            f1Sum += s > 0 ? 2.0 * m.precision[c] * m.recall[c] / s : 0.0;
            ++present;
        }
    }
    m.macroF1 = present ? f1Sum / present : 0.0;

    // Normal / Malicious view: class 0 = Normal, classes 1.. = Malicious.
    if (nClasses > 1) {
        const int benign = row[0];
        m.fpr = benign > 0 ? static_cast<double>(benign - m.confusion[0][0]) / benign : 0.0;
        int malicious = 0, detected = 0;
        for (size_t t = 1; t < nClasses; ++t)
            for (size_t p = 0; p < nClasses; ++p) {
                malicious += m.confusion[t][p];
                if (p >= 1) detected += m.confusion[t][p];
            }
        m.detectionRate = malicious > 0 ? static_cast<double>(detected) / malicious : 0.0;
    }
    return m;
}

// ---------- data helpers ----------
Dataset subset(const Dataset& ds, const vector<size_t>& idx) {
    Dataset out;
    out.featureNames = ds.featureNames;
    out.classNames = ds.classNames;
    out.X.reserve(idx.size());
    out.y.reserve(idx.size());
    for (size_t i : idx) {
        out.X.push_back(ds.X[i]);
        out.y.push_back(ds.y[i]);
    }
    return out;
}

bool dropFeature(Dataset& ds, const string& name) {
    for (size_t j = 0; j < ds.featureNames.size(); ++j) {
        if (ds.featureNames[j] == name) {
            ds.featureNames.erase(ds.featureNames.begin() + static_cast<ptrdiff_t>(j));
            for (auto& r : ds.X) r.erase(r.begin() + static_cast<ptrdiff_t>(j));
            return true;
        }
    }
    return false;
}

// Own Fisher-Yates so results do not depend on the compiler's shuffle.
void shuffleVec(vector<size_t>& v, mt19937& rng) {
    for (size_t i = v.size(); i > 1; --i) swap(v[i - 1], v[rng() % i]);
}

// Stratified folds: each class is shuffled and dealt round-robin, so every fold keeps
// roughly the class proportions of the training set.
vector<vector<size_t>> stratifiedFolds(const vector<int>& y, size_t nFolds,
                                                 unsigned seed) {
    int maxLabel = 0;
    for (int c : y) maxLabel = max(maxLabel, c);
    vector<vector<size_t>> byClass(static_cast<size_t>(maxLabel) + 1);
    for (size_t i = 0; i < y.size(); ++i) byClass[y[i]].push_back(i);

    mt19937 rng(seed);
    vector<vector<size_t>> folds(nFolds);
    size_t next = 0;
    for (auto& idx : byClass) {
        shuffleVec(idx, rng);
        for (size_t i : idx) folds[next++ % nFolds].push_back(i);
    }
    return folds;
}

// Pooled out-of-fold predictions -> one set of metrics over all training rows.
Metrics crossValidate(const Dataset& train, const vector<vector<size_t>>& folds,
                      const KnnOptions& opt) {
    const size_t n = train.y.size();
    vector<int> pooled(n, 0);
    for (const auto& valIdx : folds) {
        vector<char> inVal(n, 0);
        for (size_t i : valIdx) inVal[i] = 1;
        vector<size_t> trIdx;
        for (size_t i = 0; i < n; ++i)
            if (!inVal[i]) trIdx.push_back(i);

        KNN knn(opt);
        knn.fit(subset(train, trIdx));
        for (size_t i : valIdx) pooled[i] = knn.predict(train.X[i]);
    }
    return evaluate(train.y, pooled, train.classNames.size());
}

// ---------- printing ----------
void printConfusion(const Metrics& m, const vector<string>& names) {
    cout << "Confusion matrix (rows = true, columns = predicted)\n"
              << setw(12) << "";
    for (const auto& n : names) cout << setw(12) << n;
    cout << "\n";
    for (size_t t = 0; t < names.size(); ++t) {
        cout << setw(12) << names[t];
        for (size_t p = 0; p < names.size(); ++p) cout << setw(12) << m.confusion[t][p];
        cout << "\n";
    }
}

string variantName(double p) { return p == 1.0 ? "Manhattan" : p == 2.0 ? "Euclidean" : "Minkowski"; }

// ---------- modes ----------
int runTune(PreparedData& pd, const string& csvOut) {
    const vector<size_t> ks = {1, 3, 5, 7, 9, 11, 15};
    const vector<double> ps = {1.0, 2.0};
    const auto folds = stratifiedFolds(pd.train.y, 5, 42);
    const auto& names = pd.train.classNames;

    ofstream csv(csvOut);
    csv << "dropPort,p,weighted,k,macroF1,accuracy,fpr,detectionRate";
    for (const auto& n : names) csv << ",recall_" << n;
    csv << "\n";

    cout << fixed << setprecision(4);
    cout << "5-fold stratified CV on the training split (" << pd.train.y.size()
              << " rows). The test split is not used.\n\n";
    cout << left << setw(9) << "port" << setw(11) << "metric"
              << setw(9) << "weighted" << setw(4) << "K" << setw(9) << "macroF1"
              << setw(9) << "acc" << setw(9) << "FPR" << setw(9) << "detect"
              << "recall per class\n";

    double bestF1 = -1, bestFpr = 1;
    KnnOptions bestOpt;
    bool bestDrop = false;

    for (int drop = 0; drop <= 1; ++drop) {
        Dataset tr = pd.train;
        if (drop && !dropFeature(tr, kPortName)) {
            cout << "(" << kPortName << " is not among the selected features; skipping.)\n";
            continue;
        }
        for (double p : ps)
            for (int w = 0; w <= 1; ++w)
                for (size_t k : ks) {
                    KnnOptions o;
                    o.k = k;
                    o.p = p;
                    o.distanceWeighted = (w == 1);
                    const Metrics m = crossValidate(tr, folds, o);

                    cout << left << setw(9) << (drop ? "dropped" : "kept")
                              << setw(11) << variantName(p) << setw(9)
                              << (w ? "yes" : "no") << setw(4) << k << setw(9)
                              << m.macroF1 << setw(9) << m.accuracy << setw(9) << m.fpr
                              << setw(9) << m.detectionRate;
                    for (double r : m.recall) cout << setw(8) << r;
                    cout << "\n";

                    csv << drop << "," << p << "," << w << "," << k << "," << m.macroF1 << ","
                        << m.accuracy << "," << m.fpr << "," << m.detectionRate;
                    for (double r : m.recall) csv << "," << r;
                    csv << "\n";

                    if (m.macroF1 > bestF1 + 1e-12 ||
                        (fabs(m.macroF1 - bestF1) <= 1e-12 && m.fpr < bestFpr)) {
                        bestF1 = m.macroF1;
                        bestFpr = m.fpr;
                        bestOpt = o;
                        bestDrop = (drop == 1);
                    }
                }
    }
    cout << "\nClass order: ";
    for (const auto& n : names) cout << n << "  ";
    cout << "\nBest by macro-F1 (ties -> lower FPR): " << variantName(bestOpt.p)
              << ", K=" << bestOpt.k << ", weighted=" << bestOpt.distanceWeighted
              << ", Destination Port " << (bestDrop ? "dropped" : "kept") << " (macro-F1 "
              << bestF1 << ", FPR " << bestFpr << ")\n"
              << "Look at the whole table before choosing: if two rows are within about 0.01, "
                 "prefer the simpler setting.\n"
              << "Final run:  ./tune_knn <csv> final " << bestOpt.p << " " << bestOpt.k << " "
              << bestOpt.distanceWeighted << " " << bestDrop << "\n"
              << "Results saved to " << csvOut << "\n";
    return 0;
}

int runFinal(PreparedData& pd, double p, size_t k, bool weighted, bool dropPort) {
    Dataset tr = pd.train, te = pd.test;
    if (dropPort) {
        const bool a = dropFeature(tr, kPortName);
        const bool b = dropFeature(te, kPortName);
        if (!a || !b) cerr << "Warning: " << kPortName << " not found; nothing dropped.\n";
    }
    KnnOptions o;
    o.p = p;
    o.k = k;
    o.distanceWeighted = weighted;
    KNN knn(o);
    knn.fit(tr);

    const auto t0 = chrono::steady_clock::now();
    const vector<int> pred = knn.predictAll(te.X);
    const auto t1 = chrono::steady_clock::now();
    const double ms = chrono::duration<double, milli>(t1 - t0).count();

    const Metrics m = evaluate(te.y, pred, te.classNames.size());
    cout << fixed << setprecision(4);
    cout << "KNN on the held-out test set: " << variantName(p) << ", K=" << k
              << ", weighted=" << weighted << ", features=" << tr.featureNames.size() << "\n"
              << "Accuracy " << m.accuracy << " | macro-F1 " << m.macroF1 << " | FPR " << m.fpr
              << " | detection rate " << m.detectionRate << "\n"
              << "Prediction time for " << te.X.size() << " rows: " << setprecision(2) << ms
              << " ms\n\n"
              << setprecision(4);
    for (size_t c = 0; c < te.classNames.size(); ++c)
        cout << setw(12) << te.classNames[c] << " precision " << m.precision[c]
                  << "  recall " << m.recall[c] << "\n";
    cout << "\n";
    printConfusion(m, te.classNames);
    cout << "\nReport this once. Do not go back and retune on these numbers.\n";
    return 0;
}

}  // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        cerr << "usage: " << argv[0] << " <csv>\n"
                  << "       " << argv[0] << " <csv> final <p> <K> <weighted 0|1> <dropPort 0|1>\n";
        return 1;
    }
    try {
        PrepareOptions opt;  // default: seed 42, 80/20, 20 features, log transform on
        PreparedData pd = prepareDataset(argv[1], opt);

        if (argc >= 3 && string(argv[2]) == "final") {
            if (argc != 7) {
                cerr << "final needs: <p> <K> <weighted 0|1> <dropPort 0|1>\n";
                return 1;
            }
            return runFinal(pd, stod(argv[3]), static_cast<size_t>(stoul(argv[4])),
                            stoi(argv[5]) != 0, stoi(argv[6]) != 0);
        }
        return runTune(pd, "knn_cv_results.csv");
    } catch (const exception& e) {
        cerr << "Error: " << e.what() << "\n";
        return 2;
    }
}
