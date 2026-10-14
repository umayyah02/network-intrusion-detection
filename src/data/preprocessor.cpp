#include "preprocessor.h"
#include <algorithm>
#include <cmath>
#include <random>
#include <set>
#include <stdexcept>

namespace {

// Fisher-Yates driven directly by mt19937 output. std::shuffle is NOT specified to give the
// same order on every standard library, so we do it ourselves for a reproducible split.
void shuffleIdx(std::vector<size_t>& v, std::mt19937& rng) {
    for (size_t i = v.size(); i > 1; --i) std::swap(v[i - 1], v[rng() % i]);
}

Dataset pick(const Dataset& src, const std::vector<size_t>& idx) {
    Dataset d;
    d.featureNames = src.featureNames;
    d.classNames = src.classNames;
    d.X.reserve(idx.size());
    d.y.reserve(idx.size());
    for (size_t i : idx) { d.X.push_back(src.X[i]); d.y.push_back(src.y[i]); }
    return d;
}

std::string trimName(const std::string& s) {
    size_t b = s.find_first_not_of(" \t"), e = s.find_last_not_of(" \t");
    return b == std::string::npos ? "" : s.substr(b, e - b + 1);
}

std::string lower(std::string s) {
    for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return s;
}

std::string numToString(double v) {
    if (v == std::floor(v) && std::fabs(v) < 1e15) return std::to_string(static_cast<long long>(v));
    return std::to_string(v);
}

} // namespace

SplitResult stratifiedSplit(const Dataset& ds, double testFraction, unsigned seed) {
    if (!(testFraction > 0.0 && testFraction < 1.0))
        throw std::invalid_argument("testFraction must be between 0 and 1");
    std::string problem = validateDataset(ds);
    if (!problem.empty()) throw std::invalid_argument("stratifiedSplit: " + problem);

    std::mt19937 rng(seed);
    std::vector<std::vector<size_t>> byClass(ds.classNames.size());
    for (size_t i = 0; i < ds.y.size(); ++i) byClass[ds.y[i]].push_back(i);

    std::vector<size_t> trainIdx, testIdx;
    for (auto& rows : byClass) {                      // classes visited in fixed order 0..3
        if (rows.empty()) continue;
        shuffleIdx(rows, rng);
        size_t n = rows.size();
        size_t nTest = static_cast<size_t>(std::llround(n * testFraction));
        if (n >= 2) nTest = std::min(std::max<size_t>(nTest, 1), n - 1);
        else nTest = 0;                               // single row -> train
        testIdx.insert(testIdx.end(), rows.begin(), rows.begin() + nTest);
        trainIdx.insert(trainIdx.end(), rows.begin() + nTest, rows.end());
    }
    shuffleIdx(trainIdx, rng);
    shuffleIdx(testIdx, rng);
    return {pick(ds, trainIdx), pick(ds, testIdx)};
}

bool oneHotEncode(Dataset& ds, const std::string& columnName) {
    size_t col = ds.featureNames.size();
    for (size_t j = 0; j < ds.featureNames.size(); ++j)
        if (lower(trimName(ds.featureNames[j])) == lower(trimName(columnName))) { col = j; break; }
    if (col == ds.featureNames.size()) return false;

    std::set<double> values;
    for (const auto& row : ds.X) values.insert(row[col]);
    if (values.size() > 20) throw std::invalid_argument("oneHotEncode: '" + columnName + "' has too many distinct values");
    std::vector<double> cats(values.begin(), values.end());

    for (auto& row : ds.X) {
        std::vector<double> out;
        out.reserve(row.size() - 1 + cats.size());
        for (size_t j = 0; j < row.size(); ++j) if (j != col) out.push_back(row[j]);
        for (double c : cats) out.push_back(row[col] == c ? 1.0 : 0.0);
        row = std::move(out);
    }
    std::string base = trimName(ds.featureNames[col]);
    ds.featureNames.erase(ds.featureNames.begin() + col);
    for (double c : cats) ds.featureNames.push_back(base + "=" + numToString(c));
    return true;
}

void Scaler::fit(const Dataset& train) {
    size_t f = train.featureNames.size(), n = train.X.size();
    if (n == 0) throw std::invalid_argument("Scaler::fit: empty training set");
    mean_.assign(f, 0.0);
    std_.assign(f, 0.0);
    for (const auto& row : train.X) for (size_t j = 0; j < f; ++j) mean_[j] += row[j];
    for (double& m : mean_) m /= n;
    for (const auto& row : train.X) for (size_t j = 0; j < f; ++j) std_[j] += (row[j] - mean_[j]) * (row[j] - mean_[j]);
    for (double& s : std_) { s = std::sqrt(s / n); if (s < 1e-12) s = 1.0; }   // constant column -> all zeros
}

void Scaler::transform(Dataset& ds) const {
    if (mean_.empty()) throw std::logic_error("Scaler::transform called before fit");
    for (auto& row : ds.X) {
        if (row.size() != mean_.size()) throw std::invalid_argument("Scaler::transform: feature count mismatch");
        for (size_t j = 0; j < row.size(); ++j) row[j] = (row[j] - mean_[j]) / std_[j];
    }
}

void FeatureSelector::fit(const Dataset& train, size_t maxFeatures, double corrThreshold) {
    size_t n = train.X.size(), f = train.featureNames.size(), k = train.classNames.size();
    if (n == 0 || f == 0) throw std::invalid_argument("FeatureSelector::fit: empty training set");
    kept_.clear();
    droppedConstant = droppedCorrelated = droppedLowRank = 0;

    std::vector<double> mean(f, 0.0), var(f, 0.0);
    std::vector<std::vector<double>> cmean(k, std::vector<double>(f, 0.0)), cvar(k, std::vector<double>(f, 0.0));
    std::vector<size_t> cn(k, 0);
    for (size_t i = 0; i < n; ++i) {
        ++cn[train.y[i]];
        for (size_t j = 0; j < f; ++j) { mean[j] += train.X[i][j]; cmean[train.y[i]][j] += train.X[i][j]; }
    }
    for (size_t j = 0; j < f; ++j) mean[j] /= n;
    for (size_t c = 0; c < k; ++c) if (cn[c]) for (size_t j = 0; j < f; ++j) cmean[c][j] /= cn[c];
    for (size_t i = 0; i < n; ++i)
        for (size_t j = 0; j < f; ++j) {
            double d = train.X[i][j] - mean[j], dc = train.X[i][j] - cmean[train.y[i]][j];
            var[j] += d * d; cvar[train.y[i]][j] += dc * dc;
        }

    std::vector<std::pair<double, size_t>> ranked;   // (fisher score, feature index)
    for (size_t j = 0; j < f; ++j) {
        if (var[j] / n < 1e-12) { ++droppedConstant; continue; }
        double between = 0, within = 0;
        for (size_t c = 0; c < k; ++c) {
            if (!cn[c]) continue;
            between += cn[c] * (cmean[c][j] - mean[j]) * (cmean[c][j] - mean[j]);
            within += cvar[c][j];
        }
        ranked.push_back({between / (within + 1e-12), j});
    }
    std::stable_sort(ranked.begin(), ranked.end(),
                     [](const auto& a, const auto& b) { return a.first > b.first; });

    // standardized columns for the correlation test (only non-constant features)
    std::vector<std::vector<double>> z(f);
    for (const auto& r : ranked) {
        size_t j = r.second;
        double sd = std::sqrt(var[j] / n);
        z[j].resize(n);
        for (size_t i = 0; i < n; ++i) z[j][i] = (train.X[i][j] - mean[j]) / sd;
    }

    for (const auto& r : ranked) {
        size_t j = r.second;
        if (maxFeatures && kept_.size() >= maxFeatures) { ++droppedLowRank; continue; }
        bool redundant = false;
        for (size_t other : kept_) {
            double dot = 0;
            for (size_t i = 0; i < n; ++i) dot += z[j][i] * z[other][i];
            if (std::fabs(dot / n) > corrThreshold) { redundant = true; break; }
        }
        if (redundant) ++droppedCorrelated; else kept_.push_back(j);
    }
    std::sort(kept_.begin(), kept_.end());   // keep original column order
}

void FeatureSelector::apply(Dataset& ds) const {
    if (kept_.empty()) throw std::logic_error("FeatureSelector::apply called before fit");
    for (auto& row : ds.X) {
        std::vector<double> out;
        out.reserve(kept_.size());
        for (size_t j : kept_) out.push_back(row.at(j));
        row = std::move(out);
    }
    std::vector<std::string> names;
    for (size_t j : kept_) names.push_back(ds.featureNames.at(j));
    ds.featureNames = std::move(names);
}

PreparedData prepareDataset(const std::string& path, const PrepareOptions& opt) {
    PreparedData out;
    Dataset all = loadAndClean(path, &out.clean);
    if (all.X.size() < 2) throw std::runtime_error("Not enough usable rows to split (" + std::to_string(all.X.size()) + ")");
    for (const auto& col : opt.oneHotColumns) oneHotEncode(all, col);

    SplitResult sp = stratifiedSplit(all, opt.testFraction, opt.seed);
    out.selector.fit(sp.train, opt.maxFeatures, opt.corrThreshold);   // train only
    out.selector.apply(sp.train);
    out.selector.apply(sp.test);
    out.scaler.fit(sp.train);                                          // train only
    out.scaler.transform(sp.train);
    out.scaler.transform(sp.test);
    out.train = std::move(sp.train);
    out.test = std::move(sp.test);
    return out;
}
