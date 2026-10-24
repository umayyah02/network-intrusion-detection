#pragma once
// K-Nearest Neighbours classifier (Member 2).
// Works on the already prepared (cleaned, selected, scaled) Dataset from prepareDataset().
// Do NOT scale again before calling fit()/predict().
#include <cstddef>
#include <vector>
#include "dataset.h"

struct KnnOptions {
    size_t k = 5;                    // number of neighbours (clamped to training size)
    double p = 2.0;                  // Minkowski order: 1 = Manhattan, 2 = Euclidean, any p >= 1
    bool distanceWeighted = false;   // false: majority vote, true: each vote weighted by 1/distance
};

class KNN {
public:
    explicit KNN(KnnOptions opt = KnnOptions());

    // KNN has no real training phase: it stores the training rows.
    // Throws std::invalid_argument on empty or inconsistent data, k == 0 or p < 1.
    void fit(const Dataset& train);

    // Predicts one class index. x must have the same width as the training rows.
    int predict(const std::vector<double>& x) const;
    std::vector<int> predictAll(const std::vector<std::vector<double>>& X) const;

    const KnnOptions& options() const { return opt_; }

private:
    // Minkowski distance WITHOUT the final root (monotonic, so neighbour ranking is identical).
    double rankDistance(const std::vector<double>& a, const std::vector<double>& b) const;
    // Converts a rankDistance value into the true distance (only needed for weighted voting).
    double trueDistance(double rank) const;

    KnnOptions opt_;
    std::vector<std::vector<double>> X_;
    std::vector<int> y_;
    size_t dim_ = 0;
    size_t numClasses_ = 0;
};
