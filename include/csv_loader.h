#pragma once
#include <string>
#include <vector>
#include "record.h"

struct LoadResult {
    std::vector<Record> records;
    std::vector<std::string> featureNames;
    size_t skippedRows = 0;
    bool ok = false;        // false = the file could not be read or has a bad header
    std::string error;      // reason when ok is false
};

LoadResult loadCSV(const std::string& path);