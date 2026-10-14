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

// Label encoding. Accepts our 4 names and the raw CICIDS2017 attack names:
//   BENIGN -> 0 | DoS*, DDoS -> 1 | PortScan -> 2 | FTP-Patator, SSH-Patator, "Brute Force" -> 3
// Case and surrounding spaces are ignored. Returns -1 for anything else.
int encodeLabel(const std::string& rawLabel);

// Converts loader records into a Dataset. Rows with an unknown label are skipped
// and counted in *unknownLabel (if given).
Dataset toDataset(const LoadResult& loaded, size_t* unknownLabel = nullptr);

// Returns "" if the dataset is consistent, otherwise a message describing the first problem:
// X/y size mismatch, row width != featureNames, label index out of range, non-finite value.
std::string validateDataset(const Dataset& ds);
