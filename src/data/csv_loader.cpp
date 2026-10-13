#include "csv_loader.h"
#include <cmath>
#include <fstream>
#include <iostream>
#include <sstream>

static std::string trim(const std::string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) return "";
    size_t b = s.find_last_not_of(" \t\r\n");
    return s.substr(a, b - a + 1);
}

LoadResult loadCSV(const std::string& path) {
    LoadResult result;
    std::ifstream file(path);
    if (!file.is_open()) {
        std::cerr << "Cannot open " << path << "\n";
        return result;
    }

    std::string line;
    if (!std::getline(file, line)) return result;

    // Header: last column is the label, the rest are feature names
    std::stringstream hs(line);
    std::string name;
    while (std::getline(hs, name, ',')) result.featureNames.push_back(trim(name));
    if (!result.featureNames.empty()) result.featureNames.pop_back();

    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string cell;
        std::vector<std::string> cells;
        while (std::getline(ss, cell, ',')) cells.push_back(trim(cell));
        if (cells.size() != result.featureNames.size() + 1) { result.skippedRows++; continue; }
        

        Record r;
        r.label = cells.back();
        bool ok = true;
        for (size_t i = 0; i + 1 < cells.size(); ++i) {
            try {
                double v = std::stod(cells[i]);
                if (!std::isfinite(v)) { ok = false; break; }  // NaN / Infinity
                r.features.push_back(v);
            } catch (...) { ok = false; break; }
        }
        if (ok) result.records.push_back(r);
        else result.skippedRows++;
    }
    return result;
}