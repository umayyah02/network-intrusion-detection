#include "knn.h"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <utility>

KNN::KNN(KnnOptions opt) : opt_(opt) {}

void KNN::fit(const Dataset& train) {
    if (train.X.empty()) throw std::invalid_argument("KNN::fit: empty training set");
    if (train.X.size() != train.y.size())
        throw std::invalid_argument("KNN::fit: X and y sizes differ");
    if (opt_.k == 0) throw std::invalid_argument("KNN::fit: k must be >= 1");
    if (!(opt_.p >= 1.0)) throw std::invalid_argument("KNN::fit: p must be >= 1");

    dim_ = train.X[0].size();
    int maxLabel = -1;
    for (size_t i = 0; i < train.X.size(); ++i) {
        if (train.X[i].size() != dim_)
            throw std::invalid_argument("KNN::fit: rows have different widths");
        if (train.y[i] < 0) throw std::invalid_argument("KNN::fit: negative class index");
        maxLabel = std::max(maxLabel, train.y[i]);
    }
    X_ = train.X;
    y_ = train.y;
    numClasses_ = std::max(train.classNames.size(), static_cast<size_t>(maxLabel) + 1);
}

double KNN::rankDistance(const std::vector<double>& a, const std::vector<double>& b) const {
    double s = 0.0;
    if (opt_.p == 1.0) {
        for (size_t i = 0; i < dim_; ++i) s += std::fabs(a[i] - b[i]);
    } else if (opt_.p == 2.0) {
        for (size_t i = 0; i < dim_; ++i) {
            const double d = a[i] - b[i];
            s += d * d;  // squared Euclidean: no sqrt needed for ranking
        }
    } else {
        for (size_t i = 0; i < dim_; ++i) s += std::pow(std::fabs(a[i] - b[i]), opt_.p);
    }
    return s;
}

double KNN::trueDistance(double rank) const {
    if (opt_.p == 1.0) return rank;
    if (opt_.p == 2.0) return std::sqrt(rank);
    return std::pow(rank, 1.0 / opt_.p);
}

int KNN::predict(const std::vector<double>& x) const { return predictWithConfidence(x).label; }

Prediction KNN::predictWithConfidence(const std::vector<double>& x) const {
    if (X_.empty()) throw std::runtime_error("KNN::predict: call fit() first");
    if (x.size() != dim_) throw std::invalid_argument("KNN::predict: wrong feature count");

    const size_t n = X_.size();
    const size_t k = std::min(opt_.k, n);

    // (distance, row index): comparing the pair makes equal distances deterministic.
    std::vector<std::pair<double, size_t>> d;
    d.reserve(n);
    for (size_t i = 0; i < n; ++i) d.emplace_back(rankDistance(x, X_[i]), i);

    // Average O(n): only the k smallest need to be separated from the rest.
    std::nth_element(d.begin(), d.begin() + static_cast<std::ptrdiff_t>(k - 1), d.end());

    std::vector<double> score(numClasses_, 0.0);     // votes or weighted votes
    std::vector<double> sumDist(numClasses_, 0.0);   // for tie-breaking
    std::vector<size_t> count(numClasses_, 0);
    for (size_t j = 0; j < k; ++j) {
        const int c = y_[d[j].second];
        const double dist = trueDistance(d[j].first);
        count[c]++;
        sumDist[c] += dist;
        score[c] += opt_.distanceWeighted ? 1.0 / (dist + 1e-9) : 1.0;
    }

    // Highest score wins. Tie -> smaller summed distance. Still a tie -> lower class index.
    int best = -1;
    for (size_t c = 0; c < numClasses_; ++c) {
        if (count[c] == 0) continue;
        if (best < 0 || score[c] > score[best] + 1e-12 ||
            (std::fabs(score[c] - score[best]) <= 1e-12 && sumDist[c] < sumDist[best])) {
            best = static_cast<int>(c);
        }
    }
    return Prediction{best, static_cast<double>(count[best]) / static_cast<double>(k)};
}

std::vector<int> KNN::predictAll(const std::vector<std::vector<double>>& X) const {
    std::vector<int> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(predict(row));
    return out;
}
