#pragma once
#include <string>
#include <vector>
#include "dataset.h"

struct CleanReport {
    size_t skippedInvalid = 0;     // NaN, Infinity, non-numeric, wrong column count
    size_t unknownLabel = 0;       // labels outside our 4 classes
    size_t duplicatesRemoved = 0;  // identical features and label
};

// Removes duplicate rows (same features and same label). Keeps the first copy.
// Returns how many rows were removed.
size_t removeDuplicates(Dataset& ds);

// Number of rows per class, indexed like ds.classNames.
std::vector<size_t> classCounts(const Dataset& ds);

void printClassDistribution(const Dataset& ds);

// One call for teammates: load the CSV and return a clean Dataset.
Dataset loadAndClean(const std::string& path, CleanReport* report = nullptr);