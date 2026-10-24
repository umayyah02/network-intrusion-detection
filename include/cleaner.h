#pragma once
#include <string>
#include <vector>
#include "dataset.h"

struct CleanReport {
    size_t skippedInvalid = 0;      // NaN, Infinity, non-numeric, wrong column count (counted by the loader)
    size_t unknownLabel = 0;        // labels outside our 4 classes
    size_t duplicatesRemoved = 0;   // identical features and label
    size_t conflictingFeatures = 0; // identical features that appear with different labels (kept, reported)
};

// Removes duplicate rows (same features and same label). Keeps the first copy.
// Returns how many rows were removed.
size_t removeDuplicates(Dataset& ds);

// Number of distinct feature vectors that occur with more than one label.
size_t countConflictingFeatures(const Dataset& ds);

// Number of rows per class, indexed like ds.classNames. Out-of-range labels are ignored.
std::vector<size_t> classCounts(const Dataset& ds);

void printClassDistribution(const Dataset& ds, const std::string& title = "Class distribution");

// One call for teammates: load the CSV and return a clean, validated Dataset.
// Throws std::runtime_error if the file cannot be loaded or the result is inconsistent.
// A readable file with zero usable rows is NOT an error: it returns an empty Dataset.
Dataset loadAndClean(const std::string& path, CleanReport* report = nullptr);
