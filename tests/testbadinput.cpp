// Bad-input tests: what happens when the CSV file is empty, missing, broken or strange?
// Rule we check: the program must give a CLEAR error (or skip and COUNT the bad rows). It must never crash.
// The tests create small temporary CSV files, use them, and delete them again.
// Build target: test_badinput.  Run it from the project root (one test reads data/sample_A2.csv).
// Windows: .\test_badinput.exe
#include <cstdio>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include "preprocessor.h"

static int failures = 0;
static int notes = 0;
#define CHECK(cond) do { if (!(cond)) { ++failures; std::cout << "FAIL line " << __LINE__ << ": " #cond "\n"; } } while (0)
#define CHECK_THROWS(code, ExType) do { bool ok_ = false; \
    try { code; } catch (const ExType&) { ok_ = true; } catch (...) {} \
    if (!ok_) { ++failures; std::cout << "FAIL line " << __LINE__ << ": expected " #ExType " from " #code "\n"; } } while (0)
// NOTE = a weak spot we found. It does not fail the run; it is printed so the team can decide what to do.
#define NOTE(text) do { ++notes; std::cout << "  KNOWN ISSUE: " << text << "\n"; } while (0)

static const char* kHeader = "Destination Port,Flow Duration,Total Fwd Packets,Label\n";

// Writes a temporary CSV, returns its name. Remove it with std::remove when done.
static std::string tmp(const std::string& name, const std::string& text) {
    std::string path = "tmp_badinput_" + name + ".csv";
    std::ofstream(path, std::ios::binary) << text;
    return path;
}

// ---- files that cannot be used at all: a clear error is expected -------------------

static void testMissingFile() {
    LoadResult r = loadCSV("tmp_this_file_does_not_exist.csv");
    CHECK(!r.ok);
    CHECK(!r.error.empty());                                     // says WHY
    CHECK_THROWS(loadAndClean("tmp_this_file_does_not_exist.csv"), std::runtime_error);
    CHECK_THROWS(prepareDataset("tmp_this_file_does_not_exist.csv"), std::runtime_error);
}

static void testEmptyFile() {
    std::string f = tmp("empty", "");
    LoadResult r = loadCSV(f);
    CHECK(!r.ok);
    CHECK(!r.error.empty());
    CHECK_THROWS(loadAndClean(f), std::runtime_error);
    CHECK_THROWS(prepareDataset(f), std::runtime_error);
    std::remove(f.c_str());
}

// A picture (or any non-CSV file) renamed to .csv.
static void testNotACsv() {
    std::string f = tmp("fake", "\x89PNG\r\n\x1a\nbinary garbage that is not a table");
    LoadResult r = loadCSV(f);
    CHECK(!r.ok);
    CHECK_THROWS(prepareDataset(f), std::runtime_error);
    std::remove(f.c_str());
}

// ---- files that can be read, but contain nothing usable -----------------------------

static void testHeaderOnly() {
    std::string f = tmp("header_only", kHeader);
    LoadResult r = loadCSV(f);
    CHECK(r.ok);
    CHECK(r.records.empty());
    Dataset d = loadAndClean(f);                                 // documented: zero usable rows is NOT an error here
    CHECK(d.X.empty());
    CHECK_THROWS(prepareDataset(f), std::runtime_error);         // but the full pipeline refuses to split nothing
    std::remove(f.c_str());
}

// ---- single bad rows: skip them and COUNT them ---------------------------------------

static void testTextWhereNumberExpected() {
    std::string f = tmp("text", std::string(kHeader) + "80,100,5,BENIGN\n80,abc,5,BENIGN\n443,200,6,DoS\n");
    LoadResult r = loadCSV(f);
    CHECK(r.ok);
    CHECK(r.records.size() == 2);
    CHECK(r.skippedRows == 1);
    CleanReport rep;
    Dataset d = loadAndClean(f, &rep);
    CHECK(d.X.size() == 2);
    CHECK(rep.skippedInvalid == 1);
    std::remove(f.c_str());
}

static void testNanAndInfinity() {
    std::string f = tmp("nan", std::string(kHeader) + "80,NaN,5,BENIGN\n443,Infinity,6,DoS\n22,10,3,PortScan\n");
    CleanReport rep;
    Dataset d = loadAndClean(f, &rep);
    CHECK(d.X.size() == 1);                                      // only the clean row survives
    CHECK(rep.skippedInvalid == 2);
    std::remove(f.c_str());
}

static void testRowWithMissingColumns() {
    std::string f = tmp("short", std::string(kHeader) + "80,100,5,BENIGN\n443,200\n22,10,3,PortScan\n");
    LoadResult r = loadCSV(f);
    CHECK(r.ok);
    CHECK(r.records.size() == 2);
    CHECK(r.skippedRows == 1);
    std::remove(f.c_str());
}

static void testUnknownLabel() {
    std::string f = tmp("label", std::string(kHeader) + "80,100,5,BENIGN\n443,200,6,Martian\n22,10,3,PortScan\n");
    CleanReport rep;
    Dataset d = loadAndClean(f, &rep);
    CHECK(d.X.size() == 2);
    CHECK(rep.unknownLabel == 1);
    std::remove(f.c_str());
}

static void testDuplicates() {
    std::string f = tmp("dupes", std::string(kHeader) + "80,100,5,BENIGN\n80,100,5,BENIGN\n80,100,5,BENIGN\n");
    CleanReport rep;
    Dataset d = loadAndClean(f, &rep);
    CHECK(d.X.size() == 1);
    CHECK(rep.duplicatesRemoved == 2);
    std::remove(f.c_str());
}

// One bad row in the middle must not stop the good rows around it from loading.
static void testGoodRowsSurviveBadOnes() {
    std::string f = tmp("mixed", std::string(kHeader) +
        "80,100,5,BENIGN\n443,200,6,DoS\nabc,def,ghi,BENIGN\n22,10,3,PortScan\n21,50,4,BruteForce\n");
    CleanReport rep;
    Dataset d = loadAndClean(f, &rep);
    CHECK(d.X.size() == 4);
    CHECK(rep.skippedInvalid == 1);
    std::remove(f.c_str());
}

// ---- weak spots found while testing (printed as KNOWN ISSUE, they do not fail the run) ---

// The file has NO label column. The loader always treats the LAST column as the label,
// so it reads "Total Fwd Packets" as the label. Nothing is usable, so the pipeline stops, but the message
// does not say "label column missing".
static void testMissingLabelColumn() {
    std::string f = tmp("nolabel", "Destination Port,Flow Duration,Total Fwd Packets\n80,100,5\n443,200,6\n");
    Dataset d = loadAndClean(f);
    CHECK(d.X.empty());                                          // nothing usable gets through
    bool threw = false;
    std::string msg;
    try { prepareDataset(f); } catch (const std::exception& e) { threw = true; msg = e.what(); }
    CHECK(threw);                                                // the pipeline stops, it does not go on with garbage
    if (msg.find("abel") == std::string::npos)
        NOTE("a CSV without a label column stops with \"" + msg + "\" (it never says the label column is missing)");
    std::remove(f.c_str());
}

// Only 4 rows, 4 different classes (one row each): the split puts every row into train.
static void testTinyDataGivesEmptyTestSet() {
    std::string f = tmp("tiny", std::string(kHeader) +
        "80,100,5,BENIGN\n443,200,6,DoS\n22,10,3,PortScan\n21,50,4,BruteForce\n");
    PreparedData p;
    bool threw = false;
    try { p = prepareDataset(f); } catch (const std::exception&) { threw = true; }
    if (!threw && p.test.X.empty())
        NOTE("a very small CSV (4 rows) is accepted but gives an EMPTY test set (train=" +
             std::to_string(p.train.X.size()) + ", test=0), so any score would be meaningless");
    std::remove(f.c_str());
}

// ---- preparing a second file like the training file ----------------------------------

static void testPrepareLikeProblems() {
    PreparedData p;
    try { p = prepareDataset("data/sample_A2.csv"); }
    catch (const std::exception& e) {
        std::cout << "Could not prepare data/sample_A2.csv: " << e.what() << "\nRun this test from the project root folder.\n";
        ++failures;
        return;
    }
    CHECK_THROWS(prepareLike(p, "tmp_this_file_does_not_exist.csv"), std::runtime_error);
    std::string f = tmp("othercols", "Some Other Column,Another One,Label\n1,2,BENIGN\n3,4,DoS\n");
    CHECK_THROWS(prepareLike(p, f), std::runtime_error);         // columns differ from the training CSV
    std::remove(f.c_str());
}

int main() {
    testMissingFile();
    testEmptyFile();
    testNotACsv();
    testHeaderOnly();
    testTextWhereNumberExpected();
    testNanAndInfinity();
    testRowWithMissingColumns();
    testUnknownLabel();
    testDuplicates();
    testGoodRowsSurviveBadOnes();
    testMissingLabelColumn();
    testTinyDataGivesEmptyTestSet();
    testPrepareLikeProblems();
    if (notes > 0) std::cout << notes << " known issue(s) noted (these do not fail the run)\n";
    if (failures == 0) { std::cout << "All bad-input tests passed\n"; return 0; }
    std::cout << failures << " check(s) FAILED\n";
    return 1;
}
