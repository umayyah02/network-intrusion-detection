#pragma once
// Shared evaluation helpers for tune_knn and tune_tree, so both models are scored by the SAME code.
// (No "using namespace" in a header: it would leak into every file that includes it.)
#include <algorithm>
#include <iomanip>
#include <iostream>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include "dataset.h"
#include "preprocessor.h"

namespace evalutil {

inline const char* const kPort = "Destination Port";
inline const char* const kDuration = "Flow Duration";

// Feature sets (all built from Aizah's PrepareOptions; seed 42, 80/20, 20 features, log on):
//   all       every column, selection picks 20
//   noport    dropColumns = {"Destination Port"}                    (selection re-runs)
//   portonly  keepOnlyColumns = {"Destination Port"}                (baseline)
//   portdur   keepOnlyColumns = {"Destination Port","Flow Duration"} (baseline)
inline PrepareOptions optionsFor(const std::string& set) {
    PrepareOptions o;
    if (set == "all") {
    } else if (set == "noport") {
        o.dropColumns = {kPort};
    } else if (set == "portonly") {
        o.keepOnlyColumns = {kPort};
    } else if (set == "portdur") {
        o.keepOnlyColumns = {kPort, kDuration};
    } else {
        throw std::invalid_argument("unknown feature set '" + set +
                                    "' (use all, noport, portonly or portdur)");
    }
    return o;
}

inline std::vector<std::string> splitCommas(const std::string& s) {
    std::vector<std::string> out;
    std::string item;
    std::stringstream ss(s);
    while (std::getline(ss, item, ',')) {
        if (!item.empty()) out.push_back(item);
    }
    return out;
}

// ---------- metrics ----------
struct Metrics {
    double accuracy = 0, macroF1 = 0;
    double fpr = 0;             // benign predicted as malicious / all benign
    double detectionRate = 0;   // malicious predicted as malicious / all malicious
    double alertPrecision = 0;  // real attacks / everything flagged as malicious
    int benignCount = 0, falseAlarms = 0, flagged = 0;
    std::vector<double> recall, precision;
    std::vector<std::vector<int>> confusion;  // [true][predicted]
};

inline Metrics evaluate(const std::vector<int>& truth, const std::vector<int>& pred,
                        size_t nClasses) {
    if (truth.size() != pred.size()) throw std::invalid_argument("evaluate: size mismatch");
    Metrics m;
    m.confusion.assign(nClasses, std::vector<int>(nClasses, 0));
    for (size_t i = 0; i < truth.size(); ++i) {
        if (truth[i] < 0 || truth[i] >= static_cast<int>(nClasses) || pred[i] < 0 ||
            pred[i] >= static_cast<int>(nClasses))
            throw std::out_of_range("evaluate: class index out of range");
        m.confusion[truth[i]][pred[i]]++;
    }

    std::vector<int> row(nClasses, 0), col(nClasses, 0);
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
        m.benignCount = row[0];
        m.falseAlarms = row[0] - m.confusion[0][0];
        m.fpr = row[0] > 0 ? static_cast<double>(m.falseAlarms) / row[0] : 0.0;
        int malicious = 0, detected = 0, flagged = 0;
        for (size_t t = 0; t < nClasses; ++t)
            for (size_t p = 1; p < nClasses; ++p) {
                flagged += m.confusion[t][p];
                if (t >= 1) detected += m.confusion[t][p];
            }
        for (size_t t = 1; t < nClasses; ++t) malicious += row[t];
        m.flagged = flagged;
        m.detectionRate = malicious > 0 ? static_cast<double>(detected) / malicious : 0.0;
        m.alertPrecision = flagged > 0 ? static_cast<double>(detected) / flagged : 0.0;
    }
    return m;
}

// ---------- data helpers ----------
inline Dataset subset(const Dataset& ds, const std::vector<size_t>& idx) {
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

// Own Fisher-Yates so results do not depend on the compiler's shuffle.
inline void shuffleVec(std::vector<size_t>& v, std::mt19937& rng) {
    for (size_t i = v.size(); i > 1; --i) std::swap(v[i - 1], v[rng() % i]);
}

// Stratified folds: each class is shuffled and dealt round-robin.
inline std::vector<std::vector<size_t>> stratifiedFolds(const std::vector<int>& y, size_t nFolds,
                                                        unsigned seed) {
    int maxLabel = 0;
    for (int c : y) maxLabel = std::max(maxLabel, c);
    std::vector<std::vector<size_t>> byClass(static_cast<size_t>(maxLabel) + 1);
    for (size_t i = 0; i < y.size(); ++i) byClass[y[i]].push_back(i);

    std::mt19937 rng(seed);
    std::vector<std::vector<size_t>> folds(nFolds);
    size_t next = 0;
    for (auto& idx : byClass) {
        shuffleVec(idx, rng);
        for (size_t i : idx) folds[next++ % nFolds].push_back(i);
    }
    return folds;
}

// Pooled out-of-fold predictions -> one set of metrics over all training rows.
// makeModel() must return a fresh model with fit(const Dataset&) and predict(row).
template <class MakeModel>
Metrics crossValidate(const Dataset& train, const std::vector<std::vector<size_t>>& folds,
                      MakeModel makeModel) {
    const size_t n = train.y.size();
    std::vector<int> pooled(n, 0);
    for (const auto& valIdx : folds) {
        std::vector<char> inVal(n, 0);
        for (size_t i : valIdx) inVal[i] = 1;
        std::vector<size_t> trIdx;
        for (size_t i = 0; i < n; ++i)
            if (!inVal[i]) trIdx.push_back(i);

        auto model = makeModel();
        model.fit(subset(train, trIdx));
        for (size_t i : valIdx) pooled[i] = model.predict(train.X[i]);
    }
    return evaluate(train.y, pooled, train.classNames.size());
}

// ---------- printing ----------
inline void printConfusion(const Metrics& m, const std::vector<std::string>& names) {
    std::cout << "Confusion matrix (rows = true, columns = predicted)\n" << std::setw(12) << "";
    for (const auto& n : names) std::cout << std::setw(12) << n;
    std::cout << "\n";
    for (size_t t = 0; t < names.size(); ++t) {
        std::cout << std::setw(12) << names[t];
        for (size_t p = 0; p < names.size(); ++p) std::cout << std::setw(12) << m.confusion[t][p];
        std::cout << "\n";
    }
}

inline void printReport(const std::string& title, const Dataset& d, const std::vector<int>& pred,
                        double ms, const std::vector<std::string>& names) {
    const Metrics m = evaluate(d.y, pred, names.size());
    std::cout << "=== " << title << " (" << d.y.size() << " rows) ===\n"
              << std::fixed << std::setprecision(4) << "Accuracy " << m.accuracy
              << " | macro-F1 " << m.macroF1 << " | FPR " << m.fpr << " (" << m.falseAlarms
              << " of " << m.benignCount << " benign flagged) | detection rate "
              << m.detectionRate << " | alert precision " << m.alertPrecision << " ("
              << m.flagged << " flagged)\n"
              << "Prediction time: " << std::setprecision(2) << ms << " ms\n"
              << std::setprecision(4);
    for (size_t c = 0; c < names.size(); ++c)
        std::cout << std::setw(12) << names[c] << " precision " << m.precision[c] << "  recall "
                  << m.recall[c] << "\n";
    std::cout << "\n";
    printConfusion(m, names);
    std::cout << "\n";
}

}  // namespace evalutil
