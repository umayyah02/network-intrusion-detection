// Builds a reproducible sample from the CICIDS2017 CSV files.
//
// Usage:
//   make_sample <output.csv> <input1.csv> [input2.csv ...] [options]
//
// Options (all optional; with none of them the result is the original 1,000-row sample):
//   --seed N                 random seed (default 42)
//   --quota CLASS=N          rows to pick for a class; repeat for several classes
//                            CLASS is BENIGN, DoS, PortScan or BruteForce
//                            (default: BENIGN=400 DoS=200 PortScan=200 BruteForce=200)
//   --extra-attacks          also keep DDoS (as DoS) and Web Attack - Brute Force (as BruteForce)
//   --extra-only             DoS rows come only from DDoS and BruteForce rows only from the web
//                            brute force attack (BENIGN and PortScan are unchanged); implies
//                            --extra-attacks. Use it to build a "different attack variants" test file.
//   --raw-labels             write the original CICIDS label (DoS Hulk, DDoS, ...) instead of the
//                            merged class name; the loader maps both to the same class index
//   --exclude FILE           skip every row whose features also appear in FILE (repeatable),
//                            so the new sample shares no row with an earlier one
#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <map>
#include <random>
#include <sstream>
#include <string>
#include <unordered_set>
#include <vector>
using namespace std;

struct Options {
    string output;
    vector<string> inputs, excludes;
    unsigned seed = 42;
    map<string, size_t> quota = {{"BENIGN", 400}, {"DoS", 200}, {"PortScan", 200}, {"BruteForce", 200}};
    bool extraAttacks = false, extraOnly = false, rawLabels = false;
};

static string trim(const string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == string::npos) return "";
    size_t b = s.find_last_not_of(" \t\r\n");
    return s.substr(a, b - a + 1);
}

static string lower(string s) {
    for (char& c : s) c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
    return s;
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

struct Mapped {
    string cls;   // BENIGN, DoS, PortScan, BruteForce, or "" if we don't use this label
    bool extra;   // true for DDoS and Web Attack - Brute Force
};

// Maps raw dataset labels to the 4 classes in our PRD. Matching ignores case.
// The dash in "Web Attack - Brute Force" is stored as a strange byte in some CSV files,
// so that label is recognised by its words, not by the exact text.
static Mapped mapLabel(const string& raw) {
    string t = lower(raw);
    if (t == "benign") return {"BENIGN", false};
    if (t.rfind("dos", 0) == 0) return {"DoS", false};            // Hulk, GoldenEye, slowloris, Slowhttptest
    if (t == "ddos") return {"DoS", true};
    if (t == "portscan") return {"PortScan", false};
    if (t == "ftp-patator" || t == "ssh-patator") return {"BruteForce", false};
    if (t.rfind("web attack", 0) == 0 && t.find("brute force") != string::npos) return {"BruteForce", true};
    return {"", false};                                            // Bot, Infiltration, XSS, SQL Injection, ...
}

static bool parseArgs(int argc, char* argv[], Options& o) {
    vector<string> positional;
    for (int i = 1; i < argc; ++i) {
        string a = argv[i];
        auto next = [&](string& value) {
            if (i + 1 >= argc) { cerr << "Missing value after " << a << "\n"; return false; }
            value = argv[++i];
            return true;
        };
        string v;
        if (a == "--seed") {
            if (!next(v)) return false;
            try { o.seed = static_cast<unsigned>(stoul(v)); } catch (...) { cerr << "Bad seed: " << v << "\n"; return false; }
        } else if (a == "--quota") {
            if (!next(v)) return false;
            size_t eq = v.find('=');
            string cls = v.substr(0, eq);
            if (eq == string::npos || !o.quota.count(cls)) {
                cerr << "Bad --quota '" << v << "' (use CLASS=N with CLASS = BENIGN, DoS, PortScan or BruteForce)\n";
                return false;
            }
            try { o.quota[cls] = stoul(v.substr(eq + 1)); } catch (...) { cerr << "Bad quota number in " << v << "\n"; return false; }
        } else if (a == "--exclude") {
            if (!next(v)) return false;
            o.excludes.push_back(v);
        } else if (a == "--extra-attacks") {
            o.extraAttacks = true;
        } else if (a == "--extra-only") {
            o.extraOnly = o.extraAttacks = true;
        } else if (a == "--raw-labels") {
            o.rawLabels = true;
        } else if (a.rfind("--", 0) == 0) {
            cerr << "Unknown option " << a << "\n";
            return false;
        } else {
            positional.push_back(a);
        }
    }
    if (positional.size() < 2) return false;
    o.output = positional[0];
    o.inputs.assign(positional.begin() + 1, positional.end());
    return true;
}

int main(int argc, char* argv[]) {
    Options opt;
    if (!parseArgs(argc, argv, opt)) {
        cerr << "Usage: make_sample <output.csv> <input1.csv> [input2.csv ...]\n"
                "         [--seed N] [--quota CLASS=N]... [--extra-attacks] [--extra-only]\n"
                "         [--raw-labels] [--exclude FILE]...\n";
        return 1;
    }

    // Rows to leave out: identified by their feature columns (everything before the label).
    unordered_set<string> excluded;
    for (const string& path : opt.excludes) {
        ifstream in(path);
        if (!in) { cerr << "Cannot open exclude file " << path << "\n"; return 1; }
        string line;
        getline(in, line);   // header
        while (getline(in, line)) {
            size_t pos = line.rfind(',');
            if (pos != string::npos) excluded.insert(line.substr(0, pos));
        }
    }

    map<string, vector<string>> reservoir;  // chosen rows per class
    map<string, size_t> seen;               // rows seen per class
    mt19937 rng(opt.seed);
    string header;
    size_t excludedHits = 0;

    for (const string& path : opt.inputs) {
        ifstream in(path);
        if (!in) {
            cerr << "Cannot open " << path << "\n";
            continue;
        }
        string line;
        if (!getline(in, line)) { cerr << "Empty file " << path << "\n"; continue; }
        string h = cleanHeader(line);
        if (header.empty()) header = h;
        else if (h != header) {
            cerr << "Skipping " << path << ": its columns differ from the first file\n";
            continue;
        }

        while (getline(in, line)) {
            size_t pos = line.rfind(',');  // label is the last column
            if (pos == string::npos) continue;
            string rawLabel = trim(line.substr(pos + 1));
            Mapped m = mapLabel(rawLabel);
            if (m.cls.empty()) continue;
            if (m.extra && !opt.extraAttacks) continue;
            if (opt.extraOnly && !m.extra && (m.cls == "DoS" || m.cls == "BruteForce")) continue;
            if (!excluded.empty() && excluded.count(line.substr(0, pos))) { ++excludedHits; continue; }

            string row = line.substr(0, pos + 1) + (opt.rawLabels ? rawLabel : m.cls);
            ++seen[m.cls];
            auto& bucket = reservoir[m.cls];
            size_t cap = opt.quota[m.cls];
            if (bucket.size() < cap) {
                bucket.push_back(row);
            } else if (cap > 0) {
                uniform_int_distribution<size_t> dist(0, seen[m.cls] - 1);
                size_t j = dist(rng);
                if (j < cap) bucket[j] = row;  // replace a random earlier pick
            }
        }
        cout << "Processed " << path << "\n";
    }

    vector<string> rows;
    for (auto& entry : reservoir) {
        const string& cls = entry.first;
        vector<string>& bucket = entry.second;
        cout << cls << ": picked " << bucket.size() << " of " << seen[cls] << "\n";
        if (bucket.size() < opt.quota[cls])
            cerr << "WARNING: not enough " << cls << " rows (wanted " << opt.quota[cls]
                 << "). Did you pass all the files?\n";
        rows.insert(rows.end(), bucket.begin(), bucket.end());
    }
    if (!opt.excludes.empty()) cout << "Skipped " << excludedHits << " rows found in the exclude files\n";
    shuffle(rows.begin(), rows.end(), rng);

    ofstream out(opt.output);
    out << header << "\n";
    for (const auto& r : rows) out << r << "\n";
    cout << "Wrote " << rows.size() << " rows to " << opt.output << "\n";
    return 0;
}