#pragma once
#include <string>
#include <vector>
#include "record.h"

struct LoadResult {
    std::vector<Record> records;
    std::vector<std::string> featureNames;
    size_t skippedRows = 0;
};

LoadResult loadCSV(const std::string& path);