#include <iostream>
#include "csv_loader.h"

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: loader <csv-file>\n";
        return 1;
    }
    LoadResult result = loadCSV(argv[1]);
    std::cout << "Loaded " << result.records.size() << " records, skipped "
              << result.skippedRows << "\n";
    std::cout << "Features: " << result.featureNames.size() << "\n";
    return 0;
}