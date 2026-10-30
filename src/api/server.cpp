// INIDS backend: small local JSON API between the C++ engine and the React dashboard (PRD section 7,
// FR-A1 to FR-A4). This file only does HTTP: routing, parsing, status codes, CORS.
// All logic lives in app.cpp. The shapes of every request and response are in docs/API_CONTRACT.md.
//
//   inids_server [--port 8080] [--host 127.0.0.1] [--data-dir data] [--dataset sample_A2.csv]
//                [--allow-origin *] [--enable-severity]
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <map>
#include <string>

#include "app.h"
#include "httplib.h"

using api::ApiError;
using api::json;

namespace {

httplib::Server* g_server = nullptr;
void onSignal(int) {
    if (g_server) g_server->stop();
}

void sendJson(httplib::Response& res, int status, const json& body) {
    res.status = status;
    // "replace" keeps the server alive if a file name or message contains invalid UTF-8.
    res.set_content(body.dump(-1, ' ', false, json::error_handler_t::replace), "application/json");
}

void sendError(httplib::Response& res, int status, const std::string& code, const std::string& message) {
    json err = json::object();
    err["code"] = code;
    err["message"] = message;
    json body = json::object();
    body["error"] = err;
    sendJson(res, status, body);
}

// Wraps a handler so that any ApiError (or unexpected exception) becomes a JSON error.
template <class Fn>
httplib::Server::Handler guarded(Fn fn) {
    return [fn](const httplib::Request& req, httplib::Response& res) {
        try {
            fn(req, res);
        } catch (const ApiError& e) {
            sendError(res, e.status(), e.code(), e.what());
        } catch (const std::exception& e) {
            sendError(res, 500, "INTERNAL_ERROR", e.what());
        }
    };
}

std::map<std::string, std::string> queryOf(const httplib::Request& req) {
    std::map<std::string, std::string> q;
    for (const auto& kv : req.params) q.emplace(kv.first, kv.second);  // first value wins
    return q;
}

json parseBody(const httplib::Request& req) {
    if (req.body.empty()) return json::object();
    json b = json::parse(req.body, nullptr, false);
    if (b.is_discarded()) throw ApiError(400, "BAD_REQUEST", "The request body is not valid JSON.");
    return b;
}

// Reply of POST /api/dataset (revised contract): name, rows, columns, skipped rows.
// "columns" = the feature columns the models use after feature selection. "skippedRows" is null
// because the cleaning report is not exposed by the data layer yet.
json compactLoadResponse(const json& summary) {
    json j = json::object();
    j["name"] = summary["name"];
    j["rows"] = summary["rows"]["total"];
    j["columns"] = summary["featureCount"];
    j["skippedRows"] = nullptr;
    j["summary"] = summary;
    return j;
}

void usage() {
    std::cout << "inids_server [--port 8080] [--host 127.0.0.1] [--data-dir data]\n"
                 "             [--dataset <csv inside the data dir>] [--allow-origin *]\n"
                 "             [--enable-severity]   (adds a derived Low/Medium/High severity; off by default)\n";
}

}  // namespace

int main(int argc, char** argv) {
    std::string host = "127.0.0.1", dataDir = "data", preload, origin = "*";
    int port = 8080;
    bool severity = false;
    for (int i = 1; i < argc; ++i) {
        const std::string a = argv[i];
        auto next = [&]() -> std::string {
            if (i + 1 >= argc) {
                std::cerr << "Missing value after " << a << "\n";
                std::exit(2);
            }
            return argv[++i];
        };
        if (a == "--port") port = std::atoi(next().c_str());
        else if (a == "--host") host = next();
        else if (a == "--data-dir") dataDir = next();
        else if (a == "--dataset") preload = next();
        else if (a == "--allow-origin") origin = next();
        else if (a == "--enable-severity") severity = true;
        else if (a == "--help" || a == "-h") { usage(); return 0; }
        else { std::cerr << "Unknown option " << a << "\n"; usage(); return 2; }
    }
    if (port < 1 || port > 65535) {
        std::cerr << "--port must be between 1 and 65535\n";
        return 2;
    }

    api::App app(dataDir, severity);
    if (!preload.empty()) {
        try {
            const json s = app.loadDataset(preload);
            std::cout << "Preloaded " << preload << ": " << s["rows"]["total"] << " rows\n";
        } catch (const std::exception& e) {
            std::cerr << "Could not preload '" << preload << "': " << e.what() << "\n";
            return 1;
        }
    }

    httplib::Server svr;
    g_server = &svr;
    svr.set_payload_max_length(512u * 1024u * 1024u);  // CSV uploads

    // FR-A4: the React dev server (another origin) can call this API without browser errors.
    httplib::Headers cors = {{"Access-Control-Allow-Origin", origin},
                             {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
                             {"Access-Control-Allow-Headers", "Content-Type"},
                             {"Access-Control-Max-Age", "86400"}};
    if (origin != "*") cors.emplace("Vary", "Origin");
    svr.set_default_headers(cors);
    svr.Options(R"(.*)", [](const httplib::Request&, httplib::Response& res) { res.status = 204; });

    svr.set_error_handler([](const httplib::Request& req, httplib::Response& res) {
        if (!res.body.empty()) return;  // already a JSON error from a handler
        if (res.status == 404)
            sendError(res, 404, "NOT_FOUND", "No such endpoint: " + req.method + " " + req.path);
        else if (res.status == 413)
            sendError(res, 413, "TOO_LARGE", "The request body is too large.");
        else
            sendError(res, res.status, "HTTP_ERROR", "The request could not be processed.");
    });
    svr.set_exception_handler([](const httplib::Request&, httplib::Response& res, std::exception_ptr) {
        sendError(res, 500, "INTERNAL_ERROR", "Unexpected server error.");
    });

    // ---------- routes (PRD section 7) ----------
    svr.Get("/api/health", guarded([](const httplib::Request&, httplib::Response& res) {
                json j = json::object();
                j["status"] = "ok";
                sendJson(res, 200, j);
            }));

    svr.Get("/api/dataset/summary", guarded([&](const httplib::Request&, httplib::Response& res) {
                sendJson(res, 200, app.datasetSummary());
            }));

    svr.Get("/api/dataset/files", guarded([&](const httplib::Request&, httplib::Response& res) {
                sendJson(res, 200, app.listFiles());
            }));

    // JSON {"path": "sample_A2.csv"} for a file in the data directory, or a multipart form upload
    // with a "file" field. Both load, clean and prepare the data. /api/dataset answers in the shape
    // of the revised contract; /api/dataset/load answers with the full summary.
    auto loadHandler = [&app](bool compact) {
        return guarded([&app, compact](const httplib::Request& req, httplib::Response& res) {
            std::string rel;
            if (req.is_multipart_form_data()) {
                if (!req.has_file("file"))
                    throw ApiError(400, "BAD_REQUEST", "A multipart upload needs a form field named 'file'.");
                const auto f = req.get_file_value("file");
                rel = app.saveUpload(f.filename, f.content);
            } else {
                const json b = parseBody(req);
                if (!b.is_object() || !b.contains("path") || !b["path"].is_string())
                    throw ApiError(400, "BAD_REQUEST",
                                   "Send {\"path\": \"<csv in the data directory>\"} or upload a file.");
                rel = b["path"].get<std::string>();
            }
            const json summary = app.loadDataset(rel);
            sendJson(res, 200, compact ? compactLoadResponse(summary) : summary);
        });
    };
    svr.Post("/api/dataset", loadHandler(true));
    svr.Post("/api/dataset/load", loadHandler(false));

    svr.Get("/api/datasets", guarded([&](const httplib::Request&, httplib::Response& res) {
                sendJson(res, 200, app.datasets());
            }));

    svr.Post("/api/detect", guarded([&](const httplib::Request& req, httplib::Response& res) {
                 sendJson(res, 202, app.startDetect(parseBody(req)));
             }));

    svr.Get("/api/detect/status", guarded([&](const httplib::Request&, httplib::Response& res) {
                sendJson(res, 200, app.jobStatus());
            }));

    svr.Get("/api/detections", guarded([&](const httplib::Request& req, httplib::Response& res) {
                sendJson(res, 200, app.detections(queryOf(req)));
            }));

    svr.Get(R"(/api/detections/(\d+))", guarded([&](const httplib::Request& req, httplib::Response& res) {
                size_t id = 0;
                try {
                    id = static_cast<size_t>(std::stoull(req.matches[1]));
                } catch (const std::exception&) {
                    throw ApiError(404, "NOT_FOUND", "No detection with that id.");
                }
                sendJson(res, 200, app.detectionDetail(id, req.get_param_value("model")));
            }));

    svr.Get("/api/summary", guarded([&](const httplib::Request& req, httplib::Response& res) {
                sendJson(res, 200, app.summary(req.get_param_value("model")));
            }));

    svr.Get("/api/threats", guarded([&](const httplib::Request& req, httplib::Response& res) {
                sendJson(res, 200, app.threats(queryOf(req)));
            }));

    svr.Get(R"(/api/threats/(\d+))", guarded([&](const httplib::Request& req, httplib::Response& res) {
                size_t id = 0;
                try {
                    id = static_cast<size_t>(std::stoull(req.matches[1]));
                } catch (const std::exception&) {
                    throw ApiError(404, "NOT_FOUND", "No threat with that id.");
                }
                sendJson(res, 200, app.threatDetail(id, req.get_param_value("model")));
            }));

    svr.Get("/api/metrics", guarded([&](const httplib::Request&, httplib::Response& res) {
                sendJson(res, 200, app.metrics());
            }));

    svr.Get("/api/dashboard", guarded([&](const httplib::Request& req, httplib::Response& res) {
                sendJson(res, 200, app.dashboard(req.get_param_value("model")));
            }));

    svr.Post("/api/complexity/run", guarded([&](const httplib::Request& req, httplib::Response& res) {
                 sendJson(res, 202, app.startComplexity(parseBody(req)));
             }));

    svr.Get("/api/complexity", guarded([&](const httplib::Request&, httplib::Response& res) {
                sendJson(res, 200, app.complexity());
            }));

    std::signal(SIGINT, onSignal);
    std::signal(SIGTERM, onSignal);

    if (!svr.bind_to_port(host, port)) {
        std::cerr << "Cannot listen on " << host << ":" << port << " (port already in use?)\n";
        return 1;
    }
    std::cout << "INIDS API listening on http://" << host << ":" << port << "\n"
              << "Data directory: " << app.dataDir().generic_string() << "\n"
              << "Press Ctrl+C to stop.\n";
    svr.listen_after_bind();
    return 0;
}
