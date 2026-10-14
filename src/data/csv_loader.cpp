#include "csv_loader.h"
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <sstream>

static std::string trim(const std::string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) return "";
    size_t b = s.find_last_not_of(" \t\r\n");
    return s.substr(a, b - a + 1);
}

// Whole cell must be a finite number: "12abc", "", "NaN", "inf" and "0x10" are rejected.
static bool parseStrictDouble(const std::string& s, double& out) {
    if (s.empty()) return false;
    if (s.find_first_of("xX") != std::string::npos) return false;  // no hex
    char* end = nullptr;
    out = std::strtod(s.c_str(), &end);
    return end == s.c_str() + s.size() && std::isfinite(out);
}

LoadResult loadCSV(const std::string& path) {
    LoadResult result;
    std::ifstream file(path);
    if (!file.is_open()) {
        result.error = "cannot open file";
        return result;
    }

    std::string line;
    if (!std::getline(file, line)) {
        result.error = "file is empty (no header)";
        return result;
    }

    // Header: last column is the label, the rest are feature names
    std::stringstream hs(line);
    std::string name;
    while (std::getline(hs, name, ',')) result.featureNames.push_back(trim(name));
    if (!result.featureNames.empty()) result.featureNames.pop_back();
    if (result.featureNames.empty()) {
        result.error = "header needs at least one feature column and a label column";
        return result;
    }

    while (std::getline(file, line)) {
        if (trim(line).empty()) continue;   // ignore blank lines
        std::stringstream ss(line);
        std::string cell;
        std::vector<std::string> cells;
        while (std::getline(ss, cell, ',')) cells.push_back(trim(cell));
        if (cells.size() != result.featureNames.size() + 1) { result.skippedRows++; continue; }

        Record r;
        r.label = cells.back();
        bool valid = true;
        for (size_t i = 0; i + 1 < cells.size(); ++i) {
            double v;
            if (!parseStrictDouble(cells[i], v)) { valid = false; break; }
            r.features.push_back(v);
        }
        if (valid) result.records.push_back(r);
        else result.skippedRows++;
    }
    result.ok = true;
    return result;
}