// KNN tuning and evaluation on top of Aizah's prepareDataset / prepareLike.
// Metrics and feature sets live in eval_utils.h (shared with tune_tree).
//
//   tune_knn <csv> [sets]
//        5-fold stratified CV inside p.train for each feature set (test split never used).
//        sets = comma list of: all, noport, portonly, portdur   (default: all,noport)
//
//   tune_knn <csv> final <set> <p> <K> <weighted 0|1> [other.csv ...]
//        Fits on p.train, evaluates ONCE on p.test, then on every extra CSV (sample_B, sample_C ...)
//        prepared with prepareLike (same columns, selection and scaling as the training data).
#include <algorithm>
#include <chrono>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

#include "eval_utils.h"
#include "knn.h"
#include "preprocessor.h"

using namespace std;
using namespace evalutil;

namespace {

string variantName(double p) {
    return p == 1.0 ? "Manhattan" : p == 2.0 ? "Euclidean" : "Minkowski";
}

int runTune(const string& csvPath, const vector<string>& sets) {
    const vector<size_t> ks = {1, 3, 5, 7, 9, 11, 15};
    const vector<double> ps = {1.0, 2.0};

    ofstream csv("knn_cv_results.csv");
    csv << "set,p,weighted,k,macroF1,accuracy,fpr,detectionRate,alertPrecision";

    cout << fixed << setprecision(4);
    bool headerDone = false;
    vector<string> classOrder;

    for (const string& set : sets) {
        PreparedData pd = prepareDataset(csvPath, optionsFor(set));
        const auto& names = pd.train.classNames;
        classOrder = names;
        if (!headerDone) {
            for (const auto& n : names) csv << ",recall_" << n;
            csv << "\n";
            headerDone = true;
        }
        const auto folds = stratifiedFolds(pd.train.y, 5, 42);

        cout << "\n##### feature set '" << set << "': " << pd.train.featureNames.size()
             << " features, 5-fold stratified CV on " << pd.train.y.size()
             << " training rows (test split not used)\n";
        cout << left << setw(11) << "metric" << setw(9) << "weighted" << setw(4) << "K"
             << setw(9) << "macroF1" << setw(9) << "acc" << setw(9) << "FPR" << setw(9)
             << "detect" << "recall per class\n";

        double bestF1 = -1, bestFpr = 1;
        KnnOptions bestOpt;
        for (double p : ps)
            for (int w = 0; w <= 1; ++w)
                for (size_t k : ks) {
                    KnnOptions o;
                    o.k = k;
                    o.p = p;
                    o.distanceWeighted = (w == 1);
                    const Metrics m = crossValidate(pd.train, folds, [&] { return KNN(o); });

                    cout << left << setw(11) << variantName(p) << setw(9) << (w ? "yes" : "no")
                         << setw(4) << k << setw(9) << m.macroF1 << setw(9) << m.accuracy
                         << setw(9) << m.fpr << setw(9) << m.detectionRate;
                    for (double r : m.recall) cout << setw(8) << r;
                    cout << "\n";

                    csv << set << "," << p << "," << w << "," << k << "," << m.macroF1 << ","
                        << m.accuracy << "," << m.fpr << "," << m.detectionRate << ","
                        << m.alertPrecision;
                    for (double r : m.recall) csv << "," << r;
                    csv << "\n";

                    if (m.macroF1 > bestF1 + 1e-12 ||
                        (fabs(m.macroF1 - bestF1) <= 1e-12 && m.fpr < bestFpr)) {
                        bestF1 = m.macroF1;
                        bestFpr = m.fpr;
                        bestOpt = o;
                    }
                }
        cout << "Best for '" << set << "' by macro-F1 (ties -> lower FPR): "
             << variantName(bestOpt.p) << ", K=" << bestOpt.k
             << ", weighted=" << bestOpt.distanceWeighted << " (macro-F1 " << bestF1
             << ", FPR " << bestFpr << ")\n"
             << "  Final run: tune_knn " << csvPath << " final " << set << " " << bestOpt.p
             << " " << bestOpt.k << " " << bestOpt.distanceWeighted << " [other.csv ...]\n";
    }
    cout << "\nClass order: ";
    for (const auto& n : classOrder) cout << n << "  ";
    cout << "\nIf two rows are within about 0.01 macro-F1, prefer the simpler setting.\n"
         << "'portonly' and 'portdur' are baselines: they show how much a trivial model gets.\n"
         << "Results saved to knn_cv_results.csv\n";
    return 0;
}

int runFinal(const string& csvPath, const string& set, double p, size_t k, bool weighted,
             const vector<string>& extraFiles) {
    PreparedData pd = prepareDataset(csvPath, optionsFor(set));
    const auto& names = pd.train.classNames;

    KnnOptions o;
    o.p = p;
    o.k = k;
    o.distanceWeighted = weighted;
    KNN knn(o);
    knn.fit(pd.train);

    cout << "KNN " << variantName(p) << ", K=" << k << ", weighted=" << weighted
         << ", feature set '" << set << "' (" << pd.train.featureNames.size()
         << " features). Fitted on p.train only; nothing is retuned on the data below.\n\n";

    auto score = [&](const string& title, const Dataset& d) {
        if (d.X.empty()) {
            cout << "=== " << title << ": no usable rows, skipped ===\n\n";
            return;
        }
        const auto t0 = chrono::steady_clock::now();
        const vector<int> pred = knn.predictAll(d.X);
        const auto t1 = chrono::steady_clock::now();
        printReport(title, d, pred, chrono::duration<double, milli>(t1 - t0).count(), names);
    };

    score("held-out test split", pd.test);
    for (const string& path : extraFiles) {
        const Dataset ext = prepareLike(pd, path, nullptr);  // same columns, selection, scaling as train
        score(path, ext);
    }
    cout << "Report each result once. Do not go back and retune on these numbers.\n";
    return 0;
}

}  // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        cerr << "usage: " << argv[0] << " <csv> [sets]\n"
             << "       " << argv[0] << " <csv> final <set> <p> <K> <weighted 0|1> [other.csv ...]\n"
             << "sets: all, noport, portonly, portdur\n";
        return 1;
    }
    try {
        const string csvPath = argv[1];
        if (argc >= 3 && string(argv[2]) == "final") {
            if (argc < 7) {
                cerr << "final needs: <set> <p> <K> <weighted 0|1> [other.csv ...]\n";
                return 1;
            }
            vector<string> extras;
            for (int i = 7; i < argc; ++i) extras.push_back(argv[i]);
            return runFinal(csvPath, argv[3], stod(argv[4]),
                            static_cast<size_t>(stoul(argv[5])), stoi(argv[6]) != 0, extras);
        }
        vector<string> sets = {"all", "noport"};
        if (argc >= 3) sets = splitCommas(argv[2]);
        if (sets.empty()) throw invalid_argument("empty feature set list");
        return runTune(csvPath, sets);
    } catch (const exception& e) {
        cerr << "Error: " << e.what() << "\n";
        return 2;
    }
}
