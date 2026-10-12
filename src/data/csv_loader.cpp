#include <fstream>
#include <iostream>
#include <sstream>
#include "../../include/record.h"

std::vector<Record> loadCSV(const std::string& path) {
    std::vector<Record> records;
    std::ifstream file(path);
    if (!file.is_open()) {
        std::cerr << "Cannot open " << path << "\n";
        return records;
    }
    std::string line;
    std::getline(file, line);                 // skip header
    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string cell;
        Record r;
        std::vector<std::string> cells;
        while (std::getline(ss, cell, ',')) cells.push_back(cell);
        if (cells.size() < 2) continue;
        r.label = cells.back();
        for (size_t i = 0; i + 1 < cells.size(); ++i)
            r.features.push_back(std::stod(cells[i]));
        records.push_back(r);
    }
    return records;
}

int main() {
    auto data = loadCSV("data/sample_test.csv");
    std::cout << "Loaded " << data.size() << " records\n";
    if (!data.empty())
        std::cout << "First label: " << data[0].label << "\n";
}