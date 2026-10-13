#include <iostream>
#include "cleaner.h"

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: loader <csv-file>\n";
        return 1;
    }
    CleanReport report;
    Dataset ds = loadAndClean(argv[1], &report);

    std::cout << "Rows: " << ds.X.size() << ", features: " << ds.featureNames.size() << "\n";
    std::cout << "Skipped invalid: " << report.skippedInvalid
              << ", unknown label: " << report.unknownLabel
              << ", duplicates removed: " << report.duplicatesRemoved << "\n";
    printClassDistribution(ds);
    return 0;
}