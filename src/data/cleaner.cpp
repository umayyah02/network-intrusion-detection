#include "cleaner.h"
#include <iomanip>
#include <iostream>
#include <set>
#include <utility>

size_t removeDuplicates(Dataset& ds) {
    std::set<std::pair<std::vector<double>, int>> seen;
    std::vector<std::vector<double>> X;
    std::vector<int> y;

    for (size_t i = 0; i < ds.X.size(); ++i) {
        if (seen.insert({ds.X[i], ds.y[i]}).second) {   // true only the first time
            X.push_back(ds.X[i]);
            y.push_back(ds.y[i]);
        }
    }
    size_t removed = ds.X.size() - X.size();
    ds.X = std::move(X);
    ds.y = std::move(y);
    return removed;
}

std::vector<size_t> classCounts(const Dataset& ds) {
    std::vector<size_t> counts(ds.classNames.size(), 0);
    for (int c : ds.y) ++counts[c];
    return counts;
}

void printClassDistribution(const Dataset& ds) {
    std::vector<size_t> counts = classCounts(ds);
    std::cout << "Class distribution:\n";
    for (size_t c = 0; c < counts.size(); ++c) {
        double pct = ds.y.empty() ? 0.0 : 100.0 * counts[c] / ds.y.size();
        std::cout << "  " << ds.classNames[c] << ": " << counts[c] << " ("
                  << std::fixed << std::setprecision(1) << pct << "%)\n";
    }
}

Dataset loadAndClean(const std::string& path, CleanReport* report) {
    LoadResult loaded = loadCSV(path);
    CleanReport rep;
    rep.skippedInvalid = loaded.skippedRows;
    Dataset ds = toDataset(loaded, &rep.unknownLabel);
    rep.duplicatesRemoved = removeDuplicates(ds);
    if (report) *report = rep;
    return ds;
}