#include <iostream>
#include "csv_loader.h"

int main() {
    LoadResult r = loadCSV("data/sample_test.csv");
    std::cout << "Loaded " << r.records.size() << " records, skipped "
              << r.skippedRows << "\n";
    std::cout << "Features: " << r.featureNames.size() << "\n";
    if (!r.records.empty())
        std::cout << "First label: " << r.records[0].label << "\n";
}