// Decision Tree tuning and evaluation on top of Aizah's prepareDataset / prepareLike.
//
//   tune_tree <csv> [sets]
//        5-fold stratified CV inside p.train for each feature set (test split never used).
//        sets = comma list of: all, noport, portonly, portdur   (default: all,noport)
//        Grid: maxDepth {2,3,4,5,6,8,10,unlimited} x minSamplesLeaf {1,2,5,10}.
//
//   tune_tree <csv> final <set> <maxDepth> <minLeaf> [other.csv ...]
//        Fits on p.train, prints the top of the tree and feature importances, evaluates ONCE on
//        p.test, then on every extra CSV via prepareLike (same columns, selection and scaling).
//        maxDepth 0 = unlimited.
#include <algorithm>
#include <chrono>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

#include "decision_tree.h"
#include "eval_utils.h"
#include "preprocessor.h"

using namespace std;
using namespace evalutil;

namespace {

string depthName(size_t d) { return d == 0 ? "unlim" : to_string(d); }
size_t effDepth(size_t d) { return d == 0 ? 1000 : d; }

struct Row {
    size_t depth, leaf;
    Metrics m;
};

int runTune(const string& csvPath, const vector<string>& sets) {
    const vector<size_t> depths = {2, 3, 4, 5, 6, 8, 10, 0};
    const vector<size_t> leaves = {1, 2, 5, 10};

    ofstream csv("tree_cv_results.csv");
    csv << "set,maxDepth,minLeaf,macroF1,accuracy,fpr,detectionRate,alertPrecision";
    bool headerDone = false;
    cout << fixed << setprecision(4);

    for (const string& set : sets) {
        PreparedData pd = prepareDataset(csvPath, optionsFor(set));
        const auto& names = pd.train.classNames;
        if (!headerDone) {
            for (const auto& n : names) csv << ",recall_" << n;
            csv << "\n";
            headerDone = true;
        }
        const auto folds = stratifiedFolds(pd.train.y, 5, 42);

        cout << "\n##### feature set '" << set << "': " << pd.train.featureNames.size()
             << " features, 5-fold stratified CV on " << pd.train.y.size()
             << " training rows (test split not used)\n";
        cout << left << setw(8) << "depth" << setw(6) << "leaf" << setw(9) << "macroF1" << setw(9)
             << "acc" << setw(9) << "FPR" << setw(9) << "detect" << "recall per class\n";

        vector<Row> rows;
        for (size_t depth : depths)
            for (size_t leaf : leaves) {
                TreeOptions o;
                o.maxDepth = depth;
                o.minSamplesLeaf = leaf;
                const Metrics m = crossValidate(pd.train, folds, [&] { return DecisionTree(o); });
                rows.push_back({depth, leaf, m});

                cout << left << setw(8) << depthName(depth) << setw(6) << leaf << setw(9)
                     << m.macroF1 << setw(9) << m.accuracy << setw(9) << m.fpr << setw(9)
                     << m.detectionRate;
                for (double r : m.recall) cout << setw(8) << r;
                cout << "\n";

                csv << set << "," << depth << "," << leaf << "," << m.macroF1 << "," << m.accuracy
                    << "," << m.fpr << "," << m.detectionRate << "," << m.alertPrecision;
                for (double r : m.recall) csv << "," << r;
                csv << "\n";
            }

        // Best by macro-F1 (ties -> lower FPR), then the simplest tree within 0.005 of it.
        const Row* best = &rows[0];
        for (const Row& r : rows)
            if (r.m.macroF1 > best->m.macroF1 + 1e-12 ||
                (fabs(r.m.macroF1 - best->m.macroF1) <= 1e-12 && r.m.fpr < best->m.fpr))
                best = &r;
        const Row* simple = best;
        for (const Row& r : rows) {
            if (r.m.macroF1 < best->m.macroF1 - 0.005) continue;
            if (effDepth(r.depth) < effDepth(simple->depth) ||
                (effDepth(r.depth) == effDepth(simple->depth) && r.leaf > simple->leaf))
                simple = &r;
        }
        cout << "Best for '" << set << "' by macro-F1: depth " << depthName(best->depth)
             << ", minLeaf " << best->leaf << " (macro-F1 " << best->m.macroF1 << ", FPR "
             << best->m.fpr << ")\n"
             << "Simplest within 0.005 of the best:  depth " << depthName(simple->depth)
             << ", minLeaf " << simple->leaf << " (macro-F1 " << simple->m.macroF1 << ", FPR "
             << simple->m.fpr << ")  <- recommended\n"
             << "  Final run: tune_tree " << csvPath << " final " << set << " " << simple->depth
             << " " << simple->leaf << " [other.csv ...]\n";
    }
    cout << "\nmaxDepth 'unlim' = no limit (0 on the command line). Prefer shallower trees when "
            "scores are about equal: they overfit less and read better in the report.\n"
         << "'portonly' and 'portdur' are baselines: they show how much a trivial model gets.\n"
         << "Results saved to tree_cv_results.csv\n";
    return 0;
}

int runFinal(const string& csvPath, const string& set, size_t maxDepth, size_t minLeaf,
             const vector<string>& extraFiles) {
    PreparedData pd = prepareDataset(csvPath, optionsFor(set));
    const auto& names = pd.train.classNames;

    TreeOptions o;
    o.maxDepth = maxDepth;
    o.minSamplesLeaf = minLeaf;
    DecisionTree tree(o);
    tree.fit(pd.train);

    cout << "Decision Tree, maxDepth " << depthName(maxDepth) << ", minLeaf " << minLeaf
         << ", feature set '" << set << "' (" << pd.train.featureNames.size()
         << " features). Fitted on p.train only; nothing is retuned on the data below.\n"
         << "Tree: depth " << tree.depth() << ", " << tree.nodeCount() << " nodes, "
         << tree.leafCount() << " leaves.\n\n"
         << "Top of the tree (thresholds are in scaled units: log + z-score):\n"
         << tree.describe(pd.train.featureNames, names, 3) << "\n";

    // Top feature importances.
    const vector<double> imp = tree.featureImportance();
    vector<size_t> order(imp.size());
    for (size_t i = 0; i < order.size(); ++i) order[i] = i;
    sort(order.begin(), order.end(), [&](size_t a, size_t b) { return imp[a] > imp[b]; });
    cout << "Feature importance (share of total Gini decrease):\n" << fixed << setprecision(3);
    for (size_t i = 0; i < min<size_t>(10, order.size()); ++i) {
        if (imp[order[i]] <= 0) break;
        cout << "  " << setw(28) << left << pd.train.featureNames[order[i]] << right
             << imp[order[i]] << "\n";
    }
    cout << "\n";

    auto score = [&](const string& title, const Dataset& d) {
        if (d.X.empty()) {
            cout << "=== " << title << ": no usable rows, skipped ===\n\n";
            return;
        }
        const auto t0 = chrono::steady_clock::now();
        const vector<int> pred = tree.predictAll(d.X);
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
             << "       " << argv[0] << " <csv> final <set> <maxDepth> <minLeaf> [other.csv ...]\n"
             << "sets: all, noport, portonly, portdur   (maxDepth 0 = unlimited)\n";
        return 1;
    }
    try {
        const string csvPath = argv[1];
        if (argc >= 3 && string(argv[2]) == "final") {
            if (argc < 6) {
                cerr << "final needs: <set> <maxDepth> <minLeaf> [other.csv ...]\n";
                return 1;
            }
            vector<string> extras;
            for (int i = 6; i < argc; ++i) extras.push_back(argv[i]);
            return runFinal(csvPath, argv[3], static_cast<size_t>(stoul(argv[4])),
                            static_cast<size_t>(stoul(argv[5])), extras);
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
