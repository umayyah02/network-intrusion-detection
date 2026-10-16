#include <iostream>
#include <stdexcept>
#include "preprocessor.h"

// Usage: loader <csv-file> [seed]
// Exit codes: 0 ok, 1 bad usage, 2 load/prepare failure.
int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: loader <csv-file> [seed]\n";
        return 1;
    }
    try {
        PrepareOptions opt;
        if (argc >= 3) opt.seed = static_cast<unsigned>(std::stoul(argv[2]));
        opt.oneHotColumns = {"Protocol"};   // no-op if the CSV has no such column
        CleanReport rep;
        Dataset all = loadAndClean(argv[1], &rep);
        std::cout << "Rows after cleaning: " << all.X.size()
          << ", columns: " << all.featureNames.size() << "\n";
        for (const auto& name : all.featureNames) std::cout << "  " << name << "\n";
        printClassDistribution(all, "Overall class distribution");
        PreparedData p = prepareDataset(argv[1], opt);

        std::cout << "Skipped invalid: " << p.clean.skippedInvalid
                  << ", unknown label: " << p.clean.unknownLabel
                  << ", duplicates removed: " << p.clean.duplicatesRemoved
                  << ", conflicting feature rows: " << p.clean.conflictingFeatures << "\n";
        std::cout << "Train rows: " << p.train.X.size() << ", test rows: " << p.test.X.size()
                  << ", seed: " << opt.seed << "\n";
        std::cout << "Dropped features - constant: " << p.selector.droppedConstant
                  << ", correlated: " << p.selector.droppedCorrelated
                  << ", low rank: " << p.selector.droppedLowRank << "\n";
        std::cout << "Selected features (" << p.train.featureNames.size() << "):\n";
        for (const auto& name : p.train.featureNames) std::cout << "  " << name << "\n";
        printClassDistribution(p.train, "Train class distribution");
        printClassDistribution(p.test, "Test class distribution");
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 2;
    }
    return 0;
}
