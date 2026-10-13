#include "dataset.h"

const std::vector<std::string>& defaultClassNames() {
    static const std::vector<std::string> names = {"BENIGN", "DoS", "PortScan", "BruteForce"};
    return names;
}

Dataset toDataset(const LoadResult& loaded, size_t* unknownLabel) {
    Dataset ds;
    ds.featureNames = loaded.featureNames;
    ds.classNames = defaultClassNames();
    size_t unknown = 0;

    for (const Record& r : loaded.records) {
        int idx = -1;
        for (size_t c = 0; c < ds.classNames.size(); ++c) {
            if (ds.classNames[c] == r.label) { idx = static_cast<int>(c); break; }
        }
        if (idx < 0) { ++unknown; continue; }
        ds.X.push_back(r.features);
        ds.y.push_back(idx);
    }
    if (unknownLabel) *unknownLabel = unknown;
    return ds;
}