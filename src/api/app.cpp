#include "app.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <ctime>
#include <fstream>
#include <functional>
#include <random>

#include "severity.h"

namespace fs = std::filesystem;

namespace api {
namespace {

const char* const kTree = "decision_tree";
const char* const kKnn = "knn";

// ---------- small helpers ----------
std::string nowIso() {
    const std::time_t t = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
    std::tm tm{};
#ifdef _WIN32
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    char buf[32];
    std::strftime(buf, sizeof buf, "%Y-%m-%dT%H:%M:%SZ", &tm);
    return buf;
}

std::string lower(std::string s) {
    for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return s;
}

double msSince(std::chrono::steady_clock::time_point t0) {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}

double r6(double v) { return std::round(v * 1e6) / 1e6; }
double r3(double v) { return std::round(v * 1e3) / 1e3; }

bool isModelName(const std::string& m) { return m == kTree || m == kKnn; }

[[noreturn]] void bad(const std::string& message) { throw ApiError(400, "BAD_REQUEST", message); }

// ---------- request parameter checks (every problem is a clear 400) ----------
void rejectUnknown(const json& obj, std::initializer_list<const char*> allowed,
                   const std::string& where) {
    for (auto it = obj.begin(); it != obj.end(); ++it) {
        bool ok = false;
        for (const char* a : allowed) ok = ok || it.key() == a;
        if (!ok) bad("unknown field '" + where + it.key() + "'");
    }
}

long long paramInt(const json& p, const char* key, long long def, long long lo, long long hi) {
    if (!p.contains(key)) return def;
    const json& v = p[key];
    if (!v.is_number_integer()) bad(std::string("params.") + key + " must be an integer");
    const long long x = v.get<long long>();
    if (x < lo || x > hi)
        bad(std::string("params.") + key + " must be between " + std::to_string(lo) + " and " +
            std::to_string(hi));
    return x;
}

double paramNum(const json& p, const char* key, double def, double lo, double hi) {
    if (!p.contains(key)) return def;
    const json& v = p[key];
    if (!v.is_number()) bad(std::string("params.") + key + " must be a number");
    const double x = v.get<double>();
    if (!(x >= lo && x <= hi))
        bad(std::string("params.") + key + " must be between " + std::to_string(lo) + " and " +
            std::to_string(hi));
    return x;
}

bool paramBool(const json& p, const char* key, bool def) {
    if (!p.contains(key)) return def;
    if (!p[key].is_boolean()) bad(std::string("params.") + key + " must be true or false");
    return p[key].get<bool>();
}

std::string queryString(const std::map<std::string, std::string>& q, const char* key) {
    const auto it = q.find(key);
    return it == q.end() ? std::string() : it->second;
}

double parseDouble(const std::string& s, const char* name) {
    try {
        size_t used = 0;
        const double v = std::stod(s, &used);
        if (used != s.size()) throw std::invalid_argument("trailing");
        return v;
    } catch (const std::exception&) {
        bad(std::string(name) + " must be a number");
    }
}

long long parseInt(const std::string& s, const char* name) {
    try {
        size_t used = 0;
        const long long v = std::stoll(s, &used);
        if (used != s.size()) throw std::invalid_argument("trailing");
        return v;
    } catch (const std::exception&) {
        bad(std::string(name) + " must be an integer");
    }
}

// ---------- running a model ----------
struct RunOut {
    double trainMs = 0, predictMs = 0;
    std::vector<int> pred;
    std::vector<double> conf;
    json info = json::object();
};

template <class Model>
RunOut fitPredict(Model& model, const Dataset& train, const Dataset& test,
                  const std::function<void(double)>& progress) {
    RunOut out;
    auto t0 = std::chrono::steady_clock::now();
    model.fit(train);
    out.trainMs = msSince(t0);

    const size_t n = test.X.size();
    out.pred.reserve(n);
    out.conf.reserve(n);
    const size_t step = std::max<size_t>(1, n / 100);
    t0 = std::chrono::steady_clock::now();
    for (size_t i = 0; i < n; ++i) {
        const Prediction p = model.predictWithConfidence(test.X[i]);
        out.pred.push_back(p.label);
        out.conf.push_back(p.confidence);
        if (i % step == 0) progress(static_cast<double>(i) / static_cast<double>(n));
    }
    out.predictMs = msSince(t0);
    return out;
}

RunOut runSpec(const ModelSpec& s, const Dataset& train, const Dataset& test,
               const std::function<void(double)>& progress) {
    if (s.name == kKnn) {
        KNN m(s.knn);
        RunOut r = fitPredict(m, train, test, progress);
        r.info["storedTrainingRows"] = train.X.size();
        return r;
    }
    DecisionTree m(s.tree);
    RunOut r = fitPredict(m, train, test, progress);
    r.info["depth"] = m.depth();
    r.info["nodes"] = m.nodeCount();
    r.info["leaves"] = m.leafCount();
    const std::vector<double> imp = m.featureImportance();
    std::vector<size_t> order(imp.size());
    for (size_t i = 0; i < order.size(); ++i) order[i] = i;
    std::stable_sort(order.begin(), order.end(), [&](size_t a, size_t b) { return imp[a] > imp[b]; });
    json top = json::array();
    for (size_t i : order) {
        if (imp[i] <= 0 || top.size() >= 10) break;
        json f = json::object();
        f["name"] = i < train.featureNames.size() ? train.featureNames[i] : "feature" + std::to_string(i);
        f["importance"] = r6(imp[i]);
        top.push_back(f);
    }
    r.info["featureImportance"] = top;
    return r;
}

Dataset stratifiedSubset(const Dataset& d, double fraction, unsigned seed) {
    int maxLabel = 0;
    for (int c : d.y) maxLabel = std::max(maxLabel, c);
    std::vector<std::vector<size_t>> byClass(static_cast<size_t>(maxLabel) + 1);
    for (size_t i = 0; i < d.y.size(); ++i) byClass[d.y[i]].push_back(i);
    std::mt19937 rng(seed);
    std::vector<size_t> chosen;
    for (auto& idx : byClass) {
        if (idx.empty()) continue;
        evalutil::shuffleVec(idx, rng);
        size_t take = static_cast<size_t>(std::llround(fraction * static_cast<double>(idx.size())));
        take = std::min(idx.size(), std::max<size_t>(1, take));
        chosen.insert(chosen.end(), idx.begin(), idx.begin() + static_cast<std::ptrdiff_t>(take));
    }
    std::sort(chosen.begin(), chosen.end());
    return evalutil::subset(d, chosen);
}

json theoryJson() {
    json t = json::object();
    t["variables"] = "n = training records, f = features, h = tree height";
    t["decision_tree"] = {{"train", "O(n f log n)"},
                          {"predict", "O(h) per record"},
                          {"storage", "O(n f) for the data; the tree itself is much smaller"}};
    t["knn"] = {{"train", "none (stores the training rows)"},
                {"predict",
                 "O(n f + n log n) per query (PRD). This implementation picks the k nearest with "
                 "nth_element, which is about O(n f) on average."},
                {"storage", "O(n f)"}};
    return t;
}

// ---------- JSON builders ----------
json rowJson(const Detection& d, const ModelResult& r) {
    json j = json::object();
    j["id"] = d.id;
    j["label"] = r.classNames[d.predicted];  // predicted class name
    j["classIndex"] = d.predicted;           // predicted class number (BENIGN = 0)
    j["isMalicious"] = d.predicted != 0;
    j["confidence"] = r6(d.confidence);
    j["actualLabel"] = r.classNames[d.actual];
    j["correct"] = d.predicted == d.actual;
    if (!d.severity.empty()) j["severity"] = d.severity;  // only with --enable-severity
    return j;
}

json modelJson(const ModelResult& r) {
    const evalutil::Metrics& m = r.metrics;
    json j = json::object();
    j["model"] = r.model;
    j["params"] = r.params;
    j["info"] = r.info;
    j["trainRows"] = r.trainRows;
    j["testRows"] = r.testRows;
    j["finishedAt"] = r.finishedAt;

    json perClass = json::array();
    for (size_t c = 0; c < r.classNames.size(); ++c) {
        const double p = m.precision[c], rc = m.recall[c];
        int support = 0;
        for (int v : m.confusion[c]) support += v;
        json pc = json::object();
        pc["name"] = r.classNames[c];
        pc["precision"] = r6(p);
        pc["recall"] = r6(rc);
        pc["f1"] = r6(p + rc > 0 ? 2.0 * p * rc / (p + rc) : 0.0);
        pc["support"] = support;
        perClass.push_back(pc);
    }
    json confusion = json::object();
    confusion["labels"] = r.classNames;
    confusion["matrix"] = m.confusion;  // [true][predicted]

    json metrics = json::object();
    metrics["accuracy"] = r6(m.accuracy);
    metrics["macroF1"] = r6(m.macroF1);
    metrics["falseAlarmRate"] = r6(m.fpr);
    metrics["falseAlarms"] = m.falseAlarms;
    metrics["benignRows"] = m.benignCount;
    metrics["detectionRate"] = r6(m.detectionRate);
    metrics["alertPrecision"] = r6(m.alertPrecision);
    metrics["flagged"] = m.flagged;
    metrics["perClass"] = perClass;
    metrics["confusion"] = confusion;
    j["metrics"] = metrics;

    json timing = json::object();
    timing["trainMs"] = r3(r.trainMs);
    timing["predictMs"] = r3(r.predictMs);
    timing["predictMsPerRow"] = r6(r.testRows ? r.predictMs / static_cast<double>(r.testRows) : 0.0);
    j["timing"] = timing;

    json totals = json::object();
    totals["total"] = r.testRows;
    totals["threats"] = r.threatCount;
    totals["normal"] = r.testRows - r.threatCount;
    j["totals"] = totals;
    return j;
}

int severityRank(const std::string& s) { return s == "High" ? 3 : s == "Medium" ? 2 : 1; }

}  // namespace

// ---------- construction / paths ----------
App::App(std::string dataDir, bool severityEnabled)
    : dataDir_(std::move(dataDir)), severityEnabled_(severityEnabled) {}

App::~App() {
    if (worker_.joinable()) worker_.join();
}

fs::path App::resolve(const std::string& relPath) const {
    if (relPath.empty()) bad("path is required");
    const fs::path p(relPath);
    if (p.is_absolute() || p.has_root_name() || p.has_root_directory())
        bad("path must be relative to the data directory");
    for (const auto& part : p)
        if (part == "..") bad("path must stay inside the data directory");
    if (lower(p.extension().string()) != ".csv") bad("only .csv files can be loaded");
    const fs::path full = dataDir_ / p;
    std::error_code ec;
    if (!fs::is_regular_file(full, ec))
        throw ApiError(404, "FILE_NOT_FOUND", "No such file in the data directory: " + relPath);
    return full;
}

json App::listFiles() {
    json files = json::array();
    try {
        std::error_code ec;
        if (fs::exists(dataDir_, ec)) {
            for (fs::recursive_directory_iterator it(dataDir_, ec), end; !ec && it != end;
                 it.increment(ec)) {
                if (files.size() >= 500) break;
                std::error_code e2;
                if (!it->is_regular_file(e2) || lower(it->path().extension().string()) != ".csv")
                    continue;
                json f = json::object();
                f["path"] = fs::relative(it->path(), dataDir_, e2).generic_string();
                f["sizeBytes"] = static_cast<long long>(it->file_size(e2));
                files.push_back(f);
            }
        }
    } catch (const fs::filesystem_error&) {
        // an unreadable folder just gives a shorter list
    }
    std::sort(files.begin(), files.end(),
              [](const json& a, const json& b) { return a["path"] < b["path"]; });
    json out = json::object();
    out["dataDir"] = dataDir_.generic_string();
    out["files"] = files;
    return out;
}

json App::datasets() {
    const json files = listFiles()["files"];
    std::string loadedName;
    size_t records = 0, features = 0;
    {
        std::lock_guard<std::mutex> l(m_);
        if (data_) {
            loadedName = datasetName_;
            records = data_->train.X.size() + data_->test.X.size();
            features = data_->train.featureNames.size();
        }
    }
    json list = json::array();
    for (const json& f : files) {
        json d = json::object();
        const std::string name = f["path"].get<std::string>();
        const bool loaded = !loadedName.empty() && name == loadedName;
        d["name"] = name;
        d["records"] = loaded ? json(records) : json(nullptr);    // known only once loaded
        d["features"] = loaded ? json(features) : json(nullptr);  // features the models use
        d["status"] = loaded ? "Loaded" : "Available";
        d["sizeBytes"] = f["sizeBytes"];
        list.push_back(d);
    }
    json out = json::object();
    out["datasets"] = list;
    return out;
}

std::string App::saveUpload(const std::string& filename, const std::string& content) {
    std::string name = fs::path(filename).filename().string();
    for (char& c : name)
        if (!(std::isalnum(static_cast<unsigned char>(c)) || c == '.' || c == '-' || c == '_')) c = '_';
    if (name.size() > 100) name = name.substr(name.size() - 100);
    if (lower(fs::path(name).extension().string()) != ".csv")
        throw ApiError(400, "INVALID_CSV", "The uploaded file must be a .csv file.");
    if (content.empty()) throw ApiError(400, "INVALID_CSV", "The uploaded file is empty.");
    std::error_code ec;
    fs::create_directories(dataDir_ / "uploads", ec);
    std::ofstream out(dataDir_ / "uploads" / name, std::ios::binary | std::ios::trunc);
    if (!out) throw ApiError(500, "WRITE_FAILED", "Could not save the upload on the server");
    out.write(content.data(), static_cast<std::streamsize>(content.size()));
    out.close();
    if (!out) throw ApiError(500, "WRITE_FAILED", "Could not save the upload on the server");
    return "uploads/" + name;
}

// ---------- dataset ----------
json App::loadDataset(const std::string& relPath) {
    const fs::path full = resolve(relPath);
    {
        std::lock_guard<std::mutex> l(m_);
        if (job_.state == "running")
            throw ApiError(409, "JOB_RUNNING", "A job is running; wait for it to finish first.");
        if (loading_) throw ApiError(409, "DATASET_LOADING", "Another dataset is being loaded.");
        loading_ = true;
    }
    struct Reset {
        App* app;
        ~Reset() {
            std::lock_guard<std::mutex> l(app->m_);
            app->loading_ = false;
        }
    } reset{this};

    std::shared_ptr<const PreparedData> loaded;
    try {
        loaded = std::make_shared<PreparedData>(prepareDataset(full.string(), PrepareOptions()));
    } catch (const std::exception& e) {
        throw ApiError(400, "INVALID_CSV", e.what());
    }
    if (loaded->train.X.empty() || loaded->test.X.empty() || loaded->train.classNames.size() < 2)
        throw ApiError(400, "INVALID_CSV", "The file has too few usable rows or classes.");

    std::lock_guard<std::mutex> l(m_);
    data_ = loaded;
    datasetName_ = fs::path(relPath).generic_string();
    loadedAt_ = nowIso();
    results_.clear();
    lastModel_.clear();
    complexity_ = json();
    const int keepId = job_.id;
    job_ = Job();
    job_.id = keepId;
    return summaryLocked();
}

json App::summaryLocked() const {
    json j = json::object();
    if (!data_) {
        j["loaded"] = false;
        return j;
    }
    const Dataset& tr = data_->train;
    const Dataset& te = data_->test;
    j["loaded"] = true;
    j["name"] = datasetName_;
    j["loadedAt"] = loadedAt_;
    json rows = json::object();
    rows["total"] = tr.X.size() + te.X.size();
    rows["train"] = tr.X.size();
    rows["test"] = te.X.size();
    j["rows"] = rows;
    j["featureCount"] = tr.featureNames.size();
    j["features"] = tr.featureNames;
    j["classNames"] = tr.classNames;

    std::vector<size_t> ctr(tr.classNames.size(), 0), cte(tr.classNames.size(), 0);
    for (int c : tr.y)
        if (c >= 0 && static_cast<size_t>(c) < ctr.size()) ++ctr[c];
    for (int c : te.y)
        if (c >= 0 && static_cast<size_t>(c) < cte.size()) ++cte[c];
    json classes = json::array();
    for (size_t c = 0; c < tr.classNames.size(); ++c) {
        json cj = json::object();
        cj["index"] = c;
        cj["name"] = tr.classNames[c];
        cj["total"] = ctr[c] + cte[c];
        cj["train"] = ctr[c];
        cj["test"] = cte[c];
        classes.push_back(cj);
    }
    j["classes"] = classes;
    return j;
}

json App::datasetSummary() {
    std::lock_guard<std::mutex> l(m_);
    return summaryLocked();
}

// ---------- jobs ----------
int App::beginJobLocked(const std::string& type, const std::string& model) {
    if (job_.state == "running")
        throw ApiError(409, "JOB_RUNNING",
                       "A " + job_.type + " job is already running. Poll GET /api/detect/status.");
    if (worker_.joinable()) worker_.join();  // the previous job is finished
    const int id = job_.id + 1;
    job_ = Job();
    job_.id = id;
    job_.type = type;
    job_.model = model;
    job_.state = "running";
    job_.stage = "starting";
    job_.startedAt = nowIso();
    job_.start = std::chrono::steady_clock::now();
    return id;
}

void App::update(int jobId, const std::string& stage, double progress) {
    std::lock_guard<std::mutex> l(m_);
    if (job_.id != jobId || job_.state != "running") return;
    job_.stage = stage;
    job_.progress = std::min(1.0, std::max(0.0, progress));
}

void App::finish(int jobId, const std::string& state, const std::string& message) {
    std::lock_guard<std::mutex> l(m_);
    if (job_.id != jobId) return;
    job_.state = state;
    job_.stage = state == "done" ? "done" : "failed";
    job_.message = message;
    if (state == "done") job_.progress = 1.0;
    job_.finishedAt = nowIso();
    job_.elapsedMs = msSince(job_.start);
}

json App::jobStatus() {
    std::lock_guard<std::mutex> l(m_);
    json j = json::object();
    j["jobId"] = job_.id;
    j["type"] = job_.type;
    j["state"] = job_.state;
    j["stage"] = job_.stage;
    j["model"] = job_.model;
    j["progress"] = r3(job_.progress);
    j["message"] = job_.message;
    j["startedAt"] = job_.startedAt;
    j["finishedAt"] = job_.finishedAt;
    j["elapsedMs"] = r3(job_.state == "running" ? msSince(job_.start) : job_.elapsedMs);
    j["resultReady"] = job_.state == "done";
    return j;
}

static ModelSpec parseSpec(const std::string& model, const json& rawParams) {
    if (!isModelName(model)) bad("model must be \"decision_tree\" or \"knn\"");
    const json params = rawParams.is_null() ? json::object() : rawParams;
    if (!params.is_object()) bad("params must be an object");
    ModelSpec s;
    s.name = model;
    s.params = json::object();
    // Defaults are the settings chosen by cross-validation on the training split.
    if (model == kKnn) {
        rejectUnknown(params, {"k", "p", "distanceWeighted"}, "params.");
        s.knn.k = static_cast<size_t>(paramInt(params, "k", 1, 1, 10000));
        s.knn.p = paramNum(params, "p", 1.0, 1.0, 10.0);
        s.knn.distanceWeighted = paramBool(params, "distanceWeighted", false);
        s.params["k"] = s.knn.k;
        s.params["p"] = s.knn.p;
        s.params["distanceWeighted"] = s.knn.distanceWeighted;
    } else {
        rejectUnknown(params, {"maxDepth", "minSamplesLeaf", "minSamplesSplit", "minImpurityDecrease"},
                      "params.");
        s.tree.maxDepth = static_cast<size_t>(paramInt(params, "maxDepth", 0, 0, 64));
        s.tree.minSamplesLeaf = static_cast<size_t>(paramInt(params, "minSamplesLeaf", 2, 1, 1000000));
        s.tree.minSamplesSplit = static_cast<size_t>(paramInt(params, "minSamplesSplit", 2, 2, 1000000));
        s.tree.minImpurityDecrease = paramNum(params, "minImpurityDecrease", 0.0, 0.0, 1.0);
        s.params["maxDepth"] = s.tree.maxDepth;
        s.params["minSamplesLeaf"] = s.tree.minSamplesLeaf;
        s.params["minSamplesSplit"] = s.tree.minSamplesSplit;
        s.params["minImpurityDecrease"] = s.tree.minImpurityDecrease;
    }
    return s;
}

json App::startDetect(const json& body) {
    if (!body.is_object()) bad("the request body must be a JSON object");
    rejectUnknown(body, {"model", "params"}, "");
    const std::string model =
        body.contains("model") && body["model"].is_string() ? body["model"].get<std::string>() : "";
    const ModelSpec spec = parseSpec(model, body.contains("params") ? body["params"] : json());

    std::lock_guard<std::mutex> l(m_);
    if (!data_) throw ApiError(409, "NO_DATASET", "Load a dataset first (POST /api/dataset/load).");
    if (loading_) throw ApiError(409, "DATASET_LOADING", "A dataset is being loaded.");
    const int id = beginJobLocked("detect", spec.name);
    std::shared_ptr<const PreparedData> data = data_;
    worker_ = std::thread([this, id, spec, data] { runDetect(id, spec, data); });

    json j = json::object();
    j["jobId"] = id;
    j["type"] = "detect";
    j["state"] = "running";
    j["model"] = spec.name;
    j["params"] = spec.params;
    return j;
}

void App::runDetect(int jobId, const ModelSpec& spec, std::shared_ptr<const PreparedData> data) {
    try {
        update(jobId, "training", 0.02);
        const RunOut run =
            runSpec(spec, data->train, data->test,
                    [&](double f) { update(jobId, "predicting", 0.05 + 0.9 * f); });
        update(jobId, "evaluating", 0.96);

        auto res = std::make_shared<ModelResult>();
        res->model = spec.name;
        res->params = spec.params;
        res->info = run.info;
        res->classNames = data->train.classNames;
        res->trainRows = data->train.X.size();
        res->testRows = data->test.X.size();
        res->trainMs = run.trainMs;
        res->predictMs = run.predictMs;
        res->metrics = evalutil::evaluate(data->test.y, run.pred, res->classNames.size());
        for (size_t i = 0; i < run.pred.size(); ++i) {
            Detection d;
            d.id = i;
            d.predicted = run.pred[i];
            d.actual = data->test.y[i];
            d.confidence = run.conf[i];
            if (d.predicted != 0) {  // class 0 = BENIGN
                ++res->threatCount;
                if (severityEnabled_) d.severity = severityFor(res->classNames[d.predicted], d.confidence);
            }
            res->rows.push_back(d);
        }
        res->finishedAt = nowIso();
        {
            std::lock_guard<std::mutex> l(m_);
            if (job_.id == jobId) {
                results_[spec.name] = res;
                lastModel_ = spec.name;
            }
        }
        finish(jobId, "done", "");
    } catch (const std::exception& e) {
        finish(jobId, "failed", e.what());
    }
}

json App::startComplexity(const json& body) {
    if (!body.is_object()) bad("the request body must be a JSON object");
    rejectUnknown(body, {"models", "fractions", "repeats"}, "");

    std::vector<std::string> models;
    if (body.contains("models")) {
        if (!body["models"].is_array() || body["models"].empty())
            bad("models must be a non-empty array");
        for (const json& m : body["models"]) {
            if (!m.is_string() || !isModelName(m.get<std::string>()))
                bad("models may only contain \"decision_tree\" and \"knn\"");
            const std::string name = m.get<std::string>();
            if (std::find(models.begin(), models.end(), name) == models.end()) models.push_back(name);
        }
    } else {
        models = {kTree, kKnn};
    }

    std::vector<double> fractions;
    if (body.contains("fractions")) {
        const json& f = body["fractions"];
        if (!f.is_array() || f.empty() || f.size() > 10) bad("fractions must be an array of 1 to 10 numbers");
        for (const json& v : f) {
            if (!v.is_number() || !(v.get<double>() > 0.0 && v.get<double>() <= 1.0))
                bad("every fraction must be a number above 0 and at most 1");
            fractions.push_back(v.get<double>());
        }
        std::sort(fractions.begin(), fractions.end());
        fractions.erase(std::unique(fractions.begin(), fractions.end()), fractions.end());
    } else {
        fractions = {0.1, 0.25, 0.5, 1.0};
    }
    const int repeats = static_cast<int>(paramInt(body, "repeats", 1, 1, 10));

    std::lock_guard<std::mutex> l(m_);
    if (!data_) throw ApiError(409, "NO_DATASET", "Load a dataset first (POST /api/dataset/load).");
    if (loading_) throw ApiError(409, "DATASET_LOADING", "A dataset is being loaded.");
    const int id = beginJobLocked("complexity", "");
    std::shared_ptr<const PreparedData> data = data_;
    const std::string name = datasetName_;
    worker_ = std::thread([this, id, models, fractions, repeats, data, name] {
        runComplexity(id, models, fractions, repeats, data, name);
    });

    json j = json::object();
    j["jobId"] = id;
    j["type"] = "complexity";
    j["state"] = "running";
    j["models"] = models;
    j["fractions"] = fractions;
    j["repeats"] = repeats;
    return j;
}

void App::runComplexity(int jobId, const std::vector<std::string>& models,
                        const std::vector<double>& fractions, int repeats,
                        std::shared_ptr<const PreparedData> data, std::string datasetName) {
    try {
        json runs = json::array();
        const size_t totalSteps = models.size() * fractions.size();
        size_t done = 0;
        for (const std::string& model : models) {
            const ModelSpec spec = parseSpec(model, json());
            for (double frac : fractions) {
                const int pct = static_cast<int>(std::lround(frac * 100));
                update(jobId, model + " on " + std::to_string(pct) + "% of the training rows",
                       0.01 + 0.98 * static_cast<double>(done) / static_cast<double>(totalSteps));
                Dataset tmp;
                const Dataset* train = &data->train;
                if (frac < 1.0) {
                    tmp = stratifiedSubset(data->train, frac, 42);
                    train = &tmp;
                }
                double trainSum = 0, predictSum = 0;
                for (int rep = 0; rep < repeats; ++rep) {
                    const RunOut r = runSpec(spec, *train, data->test, [](double) {});
                    trainSum += r.trainMs;
                    predictSum += r.predictMs;
                }
                const double trainMs = trainSum / repeats, predictMs = predictSum / repeats;
                json run = json::object();
                run["model"] = model;
                run["fraction"] = frac;
                run["trainRows"] = train->X.size();
                run["testRows"] = data->test.X.size();
                run["trainMs"] = r3(trainMs);
                run["predictMs"] = r3(predictMs);
                run["memoryBytes"] = nullptr;  // not measured (P1 in the PRD)
                run["predictMsPerRow"] =
                    r6(data->test.X.empty() ? 0.0 : predictMs / static_cast<double>(data->test.X.size()));
                runs.push_back(run);
                ++done;
            }
        }
        json out = json::object();
        out["ready"] = true;
        out["datasetName"] = datasetName;
        out["repeats"] = repeats;
        out["runs"] = runs;
        out["theory"] = theoryJson();
        out["notes"] =
            "Wall-clock milliseconds on the server machine, averaged over `repeats` runs. Each run "
            "trains on a stratified share of the training rows and predicts the full test split.";
        out["finishedAt"] = nowIso();
        {
            std::lock_guard<std::mutex> l(m_);
            if (job_.id == jobId) complexity_ = out;
        }
        finish(jobId, "done", "");
    } catch (const std::exception& e) {
        finish(jobId, "failed", e.what());
    }
}

json App::complexity() {
    std::lock_guard<std::mutex> l(m_);
    if (!complexity_.is_null()) return complexity_;
    json j = json::object();
    j["ready"] = false;
    j["runs"] = json::array();
    j["theory"] = theoryJson();
    return j;
}

// ---------- results ----------
std::shared_ptr<const ModelResult> App::pickResultLocked(const std::string& model) const {
    if (!model.empty() && !isModelName(model)) bad("model must be \"decision_tree\" or \"knn\"");
    const std::string name = model.empty() ? lastModel_ : model;
    const auto it = results_.find(name);
    if (name.empty() || it == results_.end())
        throw ApiError(409, "NO_RESULTS",
                       name.empty() ? "No detection has finished yet. POST /api/detect first."
                                    : "No finished detection for '" + name + "' yet. POST /api/detect first.");
    return it->second;
}

json App::metrics() {
    std::lock_guard<std::mutex> l(m_);
    json j = json::object();
    json models = json::object();
    json available = json::array();
    for (const char* name : {kTree, kKnn}) {
        const auto it = results_.find(name);
        if (it == results_.end()) continue;
        models[name] = modelJson(*it->second);
        available.push_back(name);
    }
    j["available"] = available;
    j["models"] = models;
    if (data_) {
        j["datasetName"] = datasetName_;
        j["classNames"] = data_->train.classNames;
        j["testRows"] = data_->test.X.size();
    }
    return j;
}

json App::summary(const std::string& model) {
    std::shared_ptr<const ModelResult> r;
    std::string name;
    {
        std::lock_guard<std::mutex> l(m_);
        r = pickResultLocked(model);
        name = datasetName_;
    }
    std::vector<size_t> counts(r->classNames.size(), 0);
    for (const Detection& d : r->rows) ++counts[d.predicted];
    json j = json::object();
    j["model"] = r->model;
    j["datasetName"] = name;
    j["scope"] = "predictions on the test split";
    j["total"] = r->testRows;
    j["normal"] = r->testRows - r->threatCount;
    j["malicious"] = r->threatCount;
    json cc = json::array();
    for (size_t c = 0; c < r->classNames.size(); ++c) {
        json one = json::object();
        one["classIndex"] = c;
        one["name"] = r->classNames[c];
        one["isMalicious"] = c != 0;
        one["count"] = counts[c];
        cc.push_back(one);
    }
    j["classCounts"] = cc;
    return j;
}

json App::dashboard(const std::string& model) {
    std::shared_ptr<const ModelResult> r;
    std::string name;
    {
        std::lock_guard<std::mutex> l(m_);
        r = pickResultLocked(model);
        name = datasetName_;
    }
    json j = json::object();
    j["model"] = r->model;
    j["datasetName"] = name;
    j["finishedAt"] = r->finishedAt;
    j["totals"] = modelJson(*r)["totals"];
    j["accuracy"] = r6(r->metrics.accuracy);

    std::vector<size_t> byType(r->classNames.size(), 0);
    size_t sev[4] = {0, 0, 0, 0};
    for (const Detection& d : r->rows) {
        if (d.predicted == 0) continue;
        ++byType[d.predicted];
        if (!d.severity.empty()) ++sev[severityRank(d.severity)];
    }
    json types = json::array();
    for (size_t c = 1; c < r->classNames.size(); ++c) {
        json t = json::object();
        t["name"] = r->classNames[c];
        t["count"] = byType[c];
        types.push_back(t);
    }
    j["attackTypes"] = types;
    if (severityEnabled_) {
        json levels = json::array();
        const char* const names[] = {"", "Low", "Medium", "High"};
        for (int s = 1; s <= 3; ++s) {
            json lv = json::object();
            lv["level"] = names[s];
            lv["count"] = sev[s];
            levels.push_back(lv);
        }
        j["severity"] = levels;
    }
    return j;
}

// Shared by GET /api/detections (every test row) and GET /api/threats (flagged rows only).
json App::listRows(const std::map<std::string, std::string>& q, bool threatsOnly) {
    std::shared_ptr<const ModelResult> r;
    {
        std::lock_guard<std::mutex> l(m_);
        r = pickResultLocked(queryString(q, "model"));
    }

    std::string filter = threatsOnly ? "threats" : lower(queryString(q, "filter"));
    if (filter.empty()) filter = "all";
    if (filter != "all" && filter != "threats" && filter != "normal")
        bad("filter must be all, threats or normal");

    const std::string search = lower(queryString(q, "search"));
    std::string severity = lower(queryString(q, "severity"));
    if (!severity.empty()) {
        if (!severityEnabled_) bad("severity is not enabled on this server (start it with --enable-severity)");
        if (severity != "low" && severity != "medium" && severity != "high")
            bad("severity must be Low, Medium or High");
        severity[0] = static_cast<char>(std::toupper(static_cast<unsigned char>(severity[0])));
    }
    int attackIdx = -1;
    const std::string attack = lower(queryString(q, "attackType"));
    if (!attack.empty()) {
        for (size_t c = 1; c < r->classNames.size(); ++c)
            if (lower(r->classNames[c]) == attack) attackIdx = static_cast<int>(c);
        if (attackIdx < 0) {
            std::string names;
            for (size_t c = 1; c < r->classNames.size(); ++c)
                names += (names.empty() ? "" : ", ") + r->classNames[c];
            bad("attackType must be one of: " + names);
        }
    }
    double minConf = 0.0;
    if (!queryString(q, "minConfidence").empty()) {
        minConf = parseDouble(queryString(q, "minConfidence"), "minConfidence");
        if (minConf < 0.0 || minConf > 1.0) bad("minConfidence must be between 0 and 1");
    }
    const std::string sort = queryString(q, "sort").empty() ? "id" : queryString(q, "sort");
    if (sort != "id" && sort != "confidence" && sort != "severity" && sort != "label")
        bad("sort must be id, confidence, severity or label");
    if (sort == "severity" && !severityEnabled_)
        bad("severity is not enabled on this server (start it with --enable-severity)");
    const std::string order = queryString(q, "order").empty() ? "asc" : lower(queryString(q, "order"));
    if (order != "asc" && order != "desc") bad("order must be asc or desc");

    // /api/threats pages by 50 unless told otherwise; /api/detections returns every row unless paged.
    long long page = 1, pageSize = threatsOnly ? 50 : 0;
    if (!queryString(q, "page").empty()) page = parseInt(queryString(q, "page"), "page");
    if (!queryString(q, "pageSize").empty()) pageSize = parseInt(queryString(q, "pageSize"), "pageSize");
    if (page < 1) bad("page must be 1 or more");
    if (!queryString(q, "pageSize").empty() && (pageSize < 1 || pageSize > 100000))
        bad("pageSize must be between 1 and 100000");

    std::vector<const Detection*> rows;
    for (const Detection& d : r->rows) {
        const bool malicious = d.predicted != 0;
        if (filter == "threats" && !malicious) continue;
        if (filter == "normal" && malicious) continue;
        if (!severity.empty() && d.severity != severity) continue;
        if (attackIdx >= 0 && d.predicted != attackIdx) continue;
        if (d.confidence < minConf) continue;
        if (!search.empty()) {
            const std::string hay = lower(r->classNames[d.predicted]) + " " + lower(d.severity) + " " +
                                    lower(r->classNames[d.actual]) + " " + std::to_string(d.id);
            if (hay.find(search) == std::string::npos) continue;
        }
        rows.push_back(&d);
    }
    const bool desc = order == "desc";
    std::stable_sort(rows.begin(), rows.end(), [&](const Detection* a, const Detection* b) {
        if (sort == "confidence") return desc ? a->confidence > b->confidence : a->confidence < b->confidence;
        if (sort == "severity") {
            const int ra = severityRank(a->severity), rb = severityRank(b->severity);
            return desc ? ra > rb : ra < rb;
        }
        if (sort == "label") {
            const std::string& na = r->classNames[a->predicted];
            const std::string& nb = r->classNames[b->predicted];
            return desc ? na > nb : na < nb;
        }
        return desc ? a->id > b->id : a->id < b->id;
    });

    const size_t total = rows.size();
    const size_t ps = pageSize > 0 ? static_cast<size_t>(pageSize) : std::max<size_t>(1, total);
    const size_t start = (static_cast<size_t>(page) - 1) * ps;
    json items = json::array();
    for (size_t i = start; i < total && i < start + ps; ++i) items.push_back(rowJson(*rows[i], *r));

    json j = json::object();
    j["model"] = r->model;
    j["filter"] = filter;
    j["total"] = total;
    j["totalAll"] = threatsOnly ? r->threatCount : r->rows.size();
    j["page"] = page;
    j["pageSize"] = ps;
    j["pages"] = std::max<size_t>(1, (total + ps - 1) / ps);
    j["items"] = items;
    return j;
}

json App::rowDetail(size_t id, const std::string& model, bool threatsOnly) {
    std::shared_ptr<const ModelResult> r;
    std::shared_ptr<const PreparedData> d;
    {
        std::lock_guard<std::mutex> l(m_);
        r = pickResultLocked(model);
        d = data_;
    }
    if (id >= r->rows.size() || !d || id >= d->test.X.size() || (threatsOnly && r->rows[id].predicted == 0))
        throw ApiError(404, "NOT_FOUND",
                       "No " + std::string(threatsOnly ? "threat" : "detection") + " with id " +
                           std::to_string(id) + " for " + r->model +
                           (threatsOnly ? " (only flows flagged as malicious are threats)." : "."));
    json j = rowJson(r->rows[id], *r);
    j["model"] = r->model;
    json features = json::array();
    for (size_t f = 0; f < d->test.featureNames.size() && f < d->test.X[id].size(); ++f) {
        json fj = json::object();
        fj["name"] = d->test.featureNames[f];
        fj["value"] = r6(d->test.X[id][f]);  // scaled units (log + z-score), not raw values
        features.push_back(fj);
    }
    j["features"] = features;
    return j;
}

json App::detections(const std::map<std::string, std::string>& q) { return listRows(q, false); }
json App::detectionDetail(size_t id, const std::string& model) { return rowDetail(id, model, false); }
json App::threats(const std::map<std::string, std::string>& q) { return listRows(q, true); }
json App::threatDetail(size_t id, const std::string& model) { return rowDetail(id, model, true); }

}  // namespace api
