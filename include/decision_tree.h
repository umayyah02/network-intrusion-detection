#pragma once
// Decision Tree classifier (CART, Gini impurity) for the INIDS project (Member 2).
// Works on the prepared Dataset from prepareDataset(). It does not need scaling, but it receives
// the same data as KNN on purpose, so both models are compared fairly.
#include <cstddef>
#include <string>
#include <vector>
#include "dataset.h"

struct TreeOptions {
    size_t maxDepth = 8;               // 0 = unlimited; root is depth 0
    size_t minSamplesLeaf = 1;         // every leaf keeps at least this many training rows
    size_t minSamplesSplit = 2;        // do not split nodes smaller than this
    double minImpurityDecrease = 0.0;  // weighted Gini decrease (share of all rows) needed to split
};

class DecisionTree {
public:
    explicit DecisionTree(TreeOptions opt = TreeOptions());

    // Throws std::invalid_argument on empty or inconsistent data.
    void fit(const Dataset& train);

    // Class index for one row. A row goes left when x[feature] <= threshold.
    int predict(const std::vector<double>& x) const;
    std::vector<int> predictAll(const std::vector<std::vector<double>>& X) const;

    size_t depth() const { return depth_; }       // depth of the deepest leaf
    size_t nodeCount() const { return nodes_.size(); }
    size_t leafCount() const;

    // Share of the total Gini decrease contributed by each feature (sums to 1; empty tree: zeros).
    std::vector<double> featureImportance() const;

    // Readable if/else rules, printed down to maxPrintDepth levels.
    // Thresholds are in SCALED units (log + z-score), not raw units.
    std::string describe(const std::vector<std::string>& featureNames,
                         const std::vector<std::string>& classNames,
                         size_t maxPrintDepth = 3) const;

    const TreeOptions& options() const { return opt_; }

private:
    struct Node {
        int feature = -1;       // -1 = leaf
        double threshold = 0;
        int left = -1, right = -1;
        int label = 0;          // majority class (used by leaves, kept for inner nodes too)
        size_t n = 0;           // training rows that reached this node
        double impurity = 0;    // Gini of those rows
        double decrease = 0;    // n*gini - (nl*gini_l + nr*gini_r), in row units (inner nodes)
    };

    int build(const Dataset& d, std::vector<size_t> idx, size_t depth);
    void describeNode(int id, size_t indent, size_t level, size_t maxPrintDepth,
                      const std::vector<std::string>& featureNames,
                      const std::vector<std::string>& classNames, std::string& out) const;

    TreeOptions opt_;
    std::vector<Node> nodes_;
    size_t dim_ = 0;
    size_t numClasses_ = 0;
    size_t depth_ = 0;
    size_t totalRows_ = 0;
};
