#pragma once
#include <string>
#include <vector>
#include "csv_loader.h"

struct Dataset {
    std::vector<std::vector<double>> X;   // one row per flow, one column per feature
    std::vector<int> y;                   // class index per row, into classNames
    std::vector<std::string> featureNames;
    std::vector<std::string> classNames;
};

// Fixed class order used by the whole team: BENIGN=0, DoS=1, PortScan=2, BruteForce=3.
const std::vector<std::string>& defaultClassNames();

// Converts loader records into a Dataset. Rows with an unknown label are skipped
// and counted in *unknownLabel (if given).
Dataset toDataset(const LoadResult& loaded, size_t* unknownLabel = nullptr);