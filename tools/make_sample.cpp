// Builds a reproducible 1000-row sample from the CICIDS2017 CSV files.
// Usage: make_sample <output.csv> <input1.csv> [input2.csv ...]
#include <algorithm>
#include <fstream>
#include <iostream>
#include <map>
#include <random>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

static string trim(const string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == string::npos) return "";
    size_t b = s.find_last_not_of(" \t\r\n");
    return s.substr(a, b - a + 1);
}

// Header names in CICIDS2017 have leading spaces, so we remove them.
static string cleanHeader(const string& line) {
    stringstream ss(line);
    string name, out;
    while (getline(ss, name, ',')) {
        if (!out.empty()) out += ",";
        out += trim(name);
    }
    return out;
}

// Maps raw dataset labels to the 4 classes in our PRD.
// Returns "" for labels we don't use (those rows are skipped).
static string mapLabel(const string& raw) {
    if (raw == "BENIGN") return "BENIGN";
    if (raw.rfind("DoS", 0) == 0) return "DoS";  // Hulk, GoldenEye, slowloris, Slowhttptest
    if (raw == "PortScan") return "PortScan";
    if (raw == "FTP-Patator" || raw == "SSH-Patator") return "BruteForce";
    return "";
}

int main(int argc, char* argv[]) {
    if (argc < 3) {
        cerr << "Usage: make_sample <output.csv> <input1.csv> [input2.csv ...]\n";
        return 1;
    }

    const unsigned SEED = 42;
    map<string, size_t> capacity = {
        {"BENIGN", 400}, {"DoS", 200}, {"PortScan", 200}, {"BruteForce", 200}};
    map<string, vector<string>> reservoir;  // chosen rows per class
    map<string, size_t> seen;               // rows seen per class
    mt19937 rng(SEED);
    string header;

    for (int i = 2; i < argc; ++i) {
        ifstream in(argv[i]);
        if (!in) {
            cerr << "Cannot open " << argv[i] << "\n";
            continue;
        }
        string line;
        getline(in, line);  // first line is the header
        if (header.empty()) header = cleanHeader(line);

        while (getline(in, line)) {
            size_t pos = line.rfind(',');  // label is the last column
            if (pos == string::npos) continue;
            string cls = mapLabel(trim(line.substr(pos + 1)));
            if (cls.empty()) continue;

            string row = line.substr(0, pos + 1) + cls;  // replace label with mapped class
            ++seen[cls];
            auto& bucket = reservoir[cls];
            size_t cap = capacity[cls];
            if (bucket.size() < cap) {
                bucket.push_back(row);
            } else {
                uniform_int_distribution<size_t> dist(0, seen[cls] - 1);
                size_t j = dist(rng);
                if (j < cap) bucket[j] = row;  // replace a random earlier pick
            }
        }
        cout << "Processed " << argv[i] << "\n";
    }

    vector<string> rows;
    for (auto& entry : reservoir) {
        const string& cls = entry.first;
        vector<string>& bucket = entry.second;
        cout << cls << ": picked " << bucket.size() << " of " << seen[cls] << "\n";
        if (bucket.size() < capacity[cls])
            cerr << "WARNING: not enough " << cls << " rows. Did you pass all the files?\n";
        rows.insert(rows.end(), bucket.begin(), bucket.end());
    }
    shuffle(rows.begin(), rows.end(), rng);

    ofstream out(argv[1]);
    out << header << "\n";
    for (const auto& r : rows) out << r << "\n";
    cout << "Wrote " << rows.size() << " rows to " << argv[1] << "\n";
    return 0;
}