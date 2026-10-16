#pragma once
// Day 3 + split: encoding, feature selection, scaling, train/test split (FR-D3, FR-D4, FR-D5).
// Rule from the PRD: everything that LEARNS statistics (selection, scaling) is fitted on the
// training set only and then applied to the test set. No leakage.
#include <string>
#include <vector>
#include "cleaner.h"

struct SplitResult { Dataset train, test; };

// Stratified (each class is split separately), reproducible for a given seed on any platform.
// Classes with >= 2 rows always put at least 1 row in each side.
SplitResult stratifiedSplit(const Dataset& ds, double testFraction = 0.2, unsigned seed = 42);

// FR-D3: one-hot encoding of categorical columns (e.g. "Protocol").
// fit() learns the category list from the TRAIN set only; transform() applies that fixed list
// to train and test. A category never seen in train becomes all zeros. Columns that do not exist
// are skipped. Throws if a column has more than 20 distinct values (not really categorical).
class OneHotEncoder {
public:
    void fit(const Dataset& train, const std::vector<std::string>& columns);
    void transform(Dataset& ds) const;
private:
    struct Col { std::string name; std::vector<double> categories; };
    std::vector<Col> cols_;
};

// FR-D3: scaling, fitted on TRAIN only.
//  - binary columns (every train value is 0 or 1: flags, one-hot) are left as they are
//  - if logTransform is on, non-negative non-binary columns get log(1+x) first (tames long tails)
//  - everything else is z-scored: (x - mean) / std
// At transform time negative values in a log column are clamped to 0 before log(1+x).
class Scaler {
public:
    void fit(const Dataset& train, bool logTransform = true);
    void transform(Dataset& ds) const;
    const std::vector<double>& mean() const { return mean_; }
    const std::vector<double>& stddev() const { return std_; }
private:
    std::vector<double> mean_, std_;
    std::vector<char> binary_, log_;
};

// FR-D4: feature selection, fitted on TRAIN only.
//   1. drop constant features (zero variance)
//   2. rank the rest by Fisher score (between-class / within-class variance)
//   3. walk down the ranking, skipping any feature with |Pearson r| > corrThreshold
//      against an already kept feature, until maxFeatures are kept (0 = no limit)
class FeatureSelector {
public:
    void fit(const Dataset& train, size_t maxFeatures = 20, double corrThreshold = 0.95);
    void apply(Dataset& ds) const;
    const std::vector<size_t>& kept() const { return kept_; }
    size_t droppedConstant = 0, droppedCorrelated = 0, droppedLowRank = 0;
private:
    std::vector<size_t> kept_;
};

struct PrepareOptions {
    double testFraction = 0.2;
    unsigned seed = 42;
    size_t maxFeatures = 20;
    double corrThreshold = 0.95;
    std::vector<std::string> oneHotColumns;   // e.g. {"Protocol"}; empty = none
    bool logTransform = true;                 // log(1+x) on skewed non-negative columns before z-score
};

struct PreparedData {
    Dataset train, test;                  // scaled, selected, same feature columns
    CleanReport clean;
    OneHotEncoder encoder;
    FeatureSelector selector;
    Scaler scaler;
};

// The single call Member 2 uses: load -> clean -> split -> encode -> select -> scale.
// Throws std::runtime_error on load failure or when there are too few rows to split.
PreparedData prepareDataset(const std::string& path, const PrepareOptions& opt = PrepareOptions());