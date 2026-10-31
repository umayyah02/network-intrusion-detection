#pragma once
// Application state and background jobs behind the INIDS JSON API (Member 2).
// server.cpp only does HTTP (routing, parsing, status codes); everything else lives here, so it
// can be tested without a network.
#include <chrono>
#include <cstddef>
#include <filesystem>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include <nlohmann/json.hpp>

#include "decision_tree.h"
#include "eval_utils.h"
#include "knn.h"
#include "preprocessor.h"

namespace api {

using json = nlohmann::json;

// A validated model choice from a request, with every option filled in.
struct ModelSpec {
    std::string name;  // "decision_tree" or "knn"
    KnnOptions knn;
    TreeOptions tree;
    json params;  // the options as shown back to the client
};

// Thrown for any problem the client can fix. server.cpp turns it into
// {"error": {"code": ..., "message": ...}} with the given HTTP status.
class ApiError : public std::runtime_error {
public:
    ApiError(int status, std::string code, const std::string& message)
        : std::runtime_error(message), status_(status), code_(std::move(code)) {}
    int status() const { return status_; }
    const std::string& code() const { return code_; }

private:
    int status_;
    std::string code_;
};

// The result for one flow of the test split. predicted != 0 means the model flagged it as malicious
// (class 0 = BENIGN). `severity` stays empty unless the server was started with --enable-severity.
struct Detection {
    size_t id = 0;  // row index in the test split
    int predicted = 0;
    int actual = 0;
    double confidence = 0.0;
    std::string severity;
};

// Everything one finished detection run produced. Immutable once stored.
struct ModelResult {
    std::string model;  // "decision_tree" or "knn"
    json params;        // the options actually used (defaults filled in)
    json info;          // model-specific facts (tree depth, important features, ...)
    std::vector<std::string> classNames;
    size_t trainRows = 0, testRows = 0;
    double trainMs = 0, predictMs = 0;
    evalutil::Metrics metrics;
    std::vector<Detection> rows;  // every test row, ascending by id
    size_t threatCount = 0;       // rows with predicted != 0
    std::string finishedAt;
};

class App {
public:
    explicit App(std::string dataDir, bool severityEnabled = false);
    ~App();  // waits for a running job
    App(const App&) = delete;
    App& operator=(const App&) = delete;

    json listFiles();
    json datasets();  // the files above, with record/feature counts for the loaded one
    // relPath is relative to the data directory. Throws ApiError (400/404/409/422).
    json loadDataset(const std::string& relPath);
    // Saves an uploaded CSV under <data dir>/uploads and returns its relative path.
    std::string saveUpload(const std::string& filename, const std::string& content);
    json datasetSummary();

    json startDetect(const json& body);      // 202 + job
    json startComplexity(const json& body);  // 202 + job
    json jobStatus();

    json detections(const std::map<std::string, std::string>& query);  // every test row
    json detectionDetail(size_t id, const std::string& model);
    json threats(const std::map<std::string, std::string>& query);     // only flagged rows
    json threatDetail(size_t id, const std::string& model);
    json summary(const std::string& model);
    json metrics();
    json dashboard(const std::string& model);
    json complexity();

    const std::filesystem::path& dataDir() const { return dataDir_; }

private:
    struct Job {
        int id = 0;
        std::string type;  // "detect" or "complexity"
        std::string state = "idle";  // idle | running | done | failed
        std::string stage, model, message, startedAt, finishedAt;
        double progress = 0;
        double elapsedMs = 0;
        std::chrono::steady_clock::time_point start;
    };

    std::filesystem::path resolve(const std::string& relPath) const;
    json summaryLocked() const;
    json listRows(const std::map<std::string, std::string>& query, bool threatsOnly);
    json rowDetail(size_t id, const std::string& model, bool threatsOnly);
    std::shared_ptr<const ModelResult> pickResultLocked(const std::string& model) const;
    int beginJobLocked(const std::string& type, const std::string& model);
    void update(int jobId, const std::string& stage, double progress);
    void finish(int jobId, const std::string& state, const std::string& message);

    void runDetect(int jobId, const ModelSpec& spec, std::shared_ptr<const PreparedData> data);
    void runComplexity(int jobId, const std::vector<std::string>& models,
                       const std::vector<double>& fractions, int repeats,
                       std::shared_ptr<const PreparedData> data, std::string datasetName);

    std::filesystem::path dataDir_;
    const bool severityEnabled_;
    mutable std::mutex m_;  // guards everything below
    std::shared_ptr<const PreparedData> data_;
    std::string datasetName_, loadedAt_;
    bool loading_ = false;
    Job job_;
    std::map<std::string, std::shared_ptr<const ModelResult>> results_;
    std::string lastModel_;
    json complexity_;  // null until an experiment finished
    std::thread worker_;
};

}  // namespace api
