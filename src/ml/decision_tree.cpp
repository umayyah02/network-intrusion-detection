#include "decision_tree.h"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

using namespace std;

namespace {

double gini(const vector<size_t>& counts, size_t n) {
    if (n == 0) return 0.0;
    double sumSq = 0.0;
    for (size_t c : counts) {
        const double p = static_cast<double>(c) / static_cast<double>(n);
        sumSq += p * p;
    }
    return 1.0 - sumSq;
}

int majority(const vector<size_t>& counts) {
    int best = 0;
    for (size_t c = 1; c < counts.size(); ++c)
        if (counts[c] > counts[best]) best = static_cast<int>(c);  // tie -> lower class index
    return best;
}

}  // namespace

DecisionTree::DecisionTree(TreeOptions opt) : opt_(opt) {}

void DecisionTree::fit(const Dataset& train) {
    if (train.X.empty()) throw invalid_argument("DecisionTree::fit: empty training set");
    if (train.X.size() != train.y.size())
        throw invalid_argument("DecisionTree::fit: X and y sizes differ");
    if (opt_.minSamplesLeaf == 0) throw invalid_argument("DecisionTree::fit: minSamplesLeaf >= 1");

    dim_ = train.X[0].size();
    int maxLabel = -1;
    for (size_t i = 0; i < train.X.size(); ++i) {
        if (train.X[i].size() != dim_)
            throw invalid_argument("DecisionTree::fit: rows have different widths");
        if (train.y[i] < 0) throw invalid_argument("DecisionTree::fit: negative class index");
        maxLabel = max(maxLabel, train.y[i]);
    }
    numClasses_ = max(train.classNames.size(), static_cast<size_t>(maxLabel) + 1);
    totalRows_ = train.X.size();
    depth_ = 0;
    nodes_.clear();

    vector<size_t> idx(train.X.size());
    for (size_t i = 0; i < idx.size(); ++i) idx[i] = i;
    build(train, std::move(idx), 0);
}

int DecisionTree::build(const Dataset& d, vector<size_t> idx, size_t depth) {
    const size_t n = idx.size();
    vector<size_t> counts(numClasses_, 0);
    for (size_t i : idx) counts[d.y[i]]++;

    const int id = static_cast<int>(nodes_.size());
    nodes_.emplace_back();
    nodes_[id].n = n;
    nodes_[id].impurity = gini(counts, n);
    nodes_[id].label = majority(counts);
    depth_ = max(depth_, depth);

    const double parentImpurity = nodes_[id].impurity;
    const bool stop = parentImpurity <= 1e-15 || n < opt_.minSamplesSplit ||
                      n < 2 * opt_.minSamplesLeaf || (opt_.maxDepth > 0 && depth >= opt_.maxDepth);
    if (stop) return id;

    // Best split search: for every feature sort once, then sweep and update class counts.
    int bestFeature = -1;
    double bestThreshold = 0.0;
    double bestWeighted = 1e300;  // nl*gini_l + nr*gini_r, smaller is better

    vector<size_t> order = idx;
    for (size_t f = 0; f < dim_; ++f) {
        sort(order.begin(), order.end(), [&](size_t a, size_t b) {
            const double va = d.X[a][f], vb = d.X[b][f];
            return va < vb || (va == vb && a < b);
        });
        vector<size_t> left(numClasses_, 0), right = counts;
        for (size_t pos = 0; pos + 1 < n; ++pos) {
            const int c = d.y[order[pos]];
            left[c]++;
            right[c]--;
            const double v = d.X[order[pos]][f], w = d.X[order[pos + 1]][f];
            if (v == w) continue;  // cannot split between equal values
            const size_t nl = pos + 1, nr = n - nl;
            if (nl < opt_.minSamplesLeaf || nr < opt_.minSamplesLeaf) continue;
            const double weighted = nl * gini(left, nl) + nr * gini(right, nr);
            if (weighted < bestWeighted - 1e-12) {  // strict: ties keep the earlier feature/threshold
                bestWeighted = weighted;
                bestFeature = static_cast<int>(f);
                double mid = v + (w - v) / 2.0;
                if (!(mid < w)) mid = v;  // guard against rounding up to w
                bestThreshold = mid;
            }
        }
    }
    if (bestFeature < 0) return id;

    const double decrease = n * parentImpurity - bestWeighted;
    if (decrease < opt_.minImpurityDecrease * static_cast<double>(totalRows_) - 1e-12) return id;

    vector<size_t> leftIdx, rightIdx;
    for (size_t i : idx) (d.X[i][bestFeature] <= bestThreshold ? leftIdx : rightIdx).push_back(i);
    if (leftIdx.empty() || rightIdx.empty()) return id;  // should not happen, stay safe

    nodes_[id].feature = bestFeature;
    nodes_[id].threshold = bestThreshold;
    nodes_[id].decrease = max(0.0, decrease);

    idx.clear();
    idx.shrink_to_fit();
    const int l = build(d, std::move(leftIdx), depth + 1);
    const int r = build(d, std::move(rightIdx), depth + 1);
    nodes_[id].left = l;
    nodes_[id].right = r;
    return id;
}

int DecisionTree::predict(const vector<double>& x) const {
    if (nodes_.empty()) throw runtime_error("DecisionTree::predict: call fit() first");
    if (x.size() != dim_) throw invalid_argument("DecisionTree::predict: wrong feature count");
    int id = 0;
    while (nodes_[id].feature >= 0)
        id = x[nodes_[id].feature] <= nodes_[id].threshold ? nodes_[id].left : nodes_[id].right;
    return nodes_[id].label;
}

vector<int> DecisionTree::predictAll(const vector<vector<double>>& X) const {
    vector<int> out;
    out.reserve(X.size());
    for (const auto& row : X) out.push_back(predict(row));
    return out;
}

size_t DecisionTree::leafCount() const {
    size_t c = 0;
    for (const auto& nd : nodes_)
        if (nd.feature < 0) ++c;
    return c;
}

vector<double> DecisionTree::featureImportance() const {
    vector<double> imp(dim_, 0.0);
    double total = 0.0;
    for (const auto& nd : nodes_)
        if (nd.feature >= 0) {
            imp[nd.feature] += nd.decrease;
            total += nd.decrease;
        }
    if (total > 0)
        for (double& v : imp) v /= total;
    return imp;
}

void DecisionTree::describeNode(int id, size_t indent, size_t level, size_t maxPrintDepth,
                                const vector<string>& featureNames,
                                const vector<string>& classNames, string& out) const {
    const Node& nd = nodes_[id];
    const string pad(indent * 2, ' ');
    auto className = [&](int c) {
        return static_cast<size_t>(c) < classNames.size() ? classNames[c] : "class" + to_string(c);
    };
    if (nd.feature < 0) {
        out += pad + "-> " + className(nd.label) + "  (" + to_string(nd.n) + " rows)\n";
        return;
    }
    if (level >= maxPrintDepth) {
        out += pad + "... (subtree, " + to_string(nd.n) + " rows, mostly " + className(nd.label) +
               ")\n";
        return;
    }
    const string fname = static_cast<size_t>(nd.feature) < featureNames.size()
                             ? featureNames[nd.feature]
                             : "feature" + to_string(nd.feature);
    ostringstream thr;
    thr << fixed << setprecision(3) << nd.threshold;
    out += pad + "if " + fname + " <= " + thr.str() + ":\n";
    describeNode(nd.left, indent + 1, level + 1, maxPrintDepth, featureNames, classNames, out);
    out += pad + "else:\n";
    describeNode(nd.right, indent + 1, level + 1, maxPrintDepth, featureNames, classNames, out);
}

string DecisionTree::describe(const vector<string>& featureNames, const vector<string>& classNames,
                              size_t maxPrintDepth) const {
    if (nodes_.empty()) return "(empty tree)\n";
    string out;
    describeNode(0, 0, 0, maxPrintDepth, featureNames, classNames, out);
    return out;
}
