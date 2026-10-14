#include "dataset.h"
#include <algorithm>
#include <cctype>
#include <cmath>

const std::vector<std::string>& defaultClassNames() {
    static const std::vector<std::string> names = {"BENIGN", "DoS", "PortScan", "BruteForce"};
    return names;
}

static std::string normalizeLabel(const std::string& s) {
    size_t b = s.find_first_not_of(" \t\r\n"), e = s.find_last_not_of(" \t\r\n");
    std::string t = (b == std::string::npos) ? "" : s.substr(b, e - b + 1);
    for (char& c : t) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return t;
}

static bool contains(const std::string& s, const char* part) { return s.find(part) != std::string::npos; }

int encodeLabel(const std::string& rawLabel) {
    std::string t = normalizeLabel(rawLabel);
    if (t == "benign") return 0;
    if (t.rfind("dos", 0) == 0 || t == "ddos") return 1;          // DoS Hulk, DoS slowloris, DDoS, ...
    if (t == "portscan" || t == "port scan") return 2;
    if (contains(t, "patator") || contains(t, "brute force") || t == "bruteforce") return 3;
    return -1;
}

Dataset toDataset(const LoadResult& loaded, size_t* unknownLabel) {
    Dataset ds;
    ds.featureNames = loaded.featureNames;
    ds.classNames = defaultClassNames();
    size_t unknown = 0;

    for (const Record& r : loaded.records) {
        int idx = encodeLabel(r.label);
        if (idx < 0) { ++unknown; continue; }
        ds.X.push_back(r.features);
        ds.y.push_back(idx);
    }
    if (unknownLabel) *unknownLabel = unknown;
    return ds;
}

std::string validateDataset(const Dataset& ds) {
    if (ds.X.size() != ds.y.size())
        return "X has " + std::to_string(ds.X.size()) + " rows but y has " + std::to_string(ds.y.size());
    for (size_t i = 0; i < ds.X.size(); ++i) {
        if (ds.X[i].size() != ds.featureNames.size())
            return "row " + std::to_string(i) + " has " + std::to_string(ds.X[i].size()) +
                   " values, expected " + std::to_string(ds.featureNames.size());
        if (ds.y[i] < 0 || static_cast<size_t>(ds.y[i]) >= ds.classNames.size())
            return "row " + std::to_string(i) + " has label index " + std::to_string(ds.y[i]) + " out of range";
        for (double v : ds.X[i])
            if (!std::isfinite(v)) return "row " + std::to_string(i) + " contains NaN/Infinity";
    }
    return "";
}
