#!/usr/bin/env bash
# Smoke test for the INIDS API (every endpoint, plus the main error cases).
# Start the server first, with a CSV inside its data directory:
#     inids_server --data-dir data
#     tests/api_smoke.sh sample_A2.csv            # uses http://127.0.0.1:8080
#     BASE=http://127.0.0.1:9000 tests/api_smoke.sh sample_A2.csv
# Needs bash and curl only (Git Bash on Windows works).
set -u
BASE=${BASE:-http://127.0.0.1:8080}
CSV=${1:-sample_A2.csv}
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
pass=0
fail=0

# req NAME EXPECTED_STATUS EXPECTED_TEXT curl-args...   (EXPECTED_TEXT may be empty)
req() {
  local name=$1 want=$2 text=$3
  shift 3
  local code
  code=$(curl -s -o "$TMP" -w '%{http_code}' "$@")
  if [ "$code" = "$want" ] && { [ -z "$text" ] || grep -q -- "$text" "$TMP"; }; then
    pass=$((pass + 1))
    echo "ok    $name"
  else
    fail=$((fail + 1))
    echo "FAIL  $name (status $code, wanted $want, text '$text')"
    head -c 300 "$TMP"
    echo
  fi
}

wait_job() {
  local i
  for i in $(seq 1 240); do
    curl -s "$BASE/api/detect/status" >"$TMP"
    grep -q '"state":"running"' "$TMP" || return 0
    sleep 0.5
  done
  echo "job did not finish in 120 s"
  return 1
}

req "health" 200 '"status":"ok"' "$BASE/api/health"
curl -s -D - -o /dev/null -H 'Origin: http://localhost:5173' "$BASE/api/health" | grep -qi 'access-control-allow-origin' \
  && { pass=$((pass + 1)); echo "ok    CORS allow-origin header"; } \
  || { fail=$((fail + 1)); echo "FAIL  CORS allow-origin header"; }
req "preflight" 204 '' -X OPTIONS "$BASE/api/detect" -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: POST'
req "files list" 200 '"files"' "$BASE/api/dataset/files"
req "datasets list" 200 '"datasets"' "$BASE/api/datasets"
req "datasets: nothing loaded yet" 200 '"status":"Available"' "$BASE/api/datasets"

req "detect before load is refused" 409 'NO_DATASET' -X POST "$BASE/api/detect" -d '{"model":"knn"}'
req "load: path traversal" 400 'BAD_REQUEST' -X POST "$BASE/api/dataset/load" -d '{"path":"../x.csv"}'
req "load: missing file" 404 'FILE_NOT_FOUND' -X POST "$BASE/api/dataset/load" -d '{"path":"does_not_exist.csv"}'
req "load: bad json" 400 'BAD_REQUEST' -X POST "$BASE/api/dataset/load" -d 'nope'
req "load dataset (compact reply)" 200 '"skippedRows":null' -X POST "$BASE/api/dataset" -d "{\"path\":\"$CSV\"}"
req "load dataset (full summary)" 200 '"loaded":true' -X POST "$BASE/api/dataset/load" -d "{\"path\":\"$CSV\"}"
req "datasets: loaded one is marked" 200 '"status":"Loaded"' "$BASE/api/datasets"
req "summary" 200 '"classes"' "$BASE/api/dataset/summary"

req "detect: bad model" 400 'BAD_REQUEST' -X POST "$BASE/api/detect" -d '{"model":"svm"}'
req "detect: bad param" 400 'params.k' -X POST "$BASE/api/detect" -d '{"model":"knn","params":{"k":0}}'
req "detect: unknown param" 400 'unknown field' -X POST "$BASE/api/detect" -d '{"model":"knn","params":{"depth":3}}'
req "threats before a run" 409 'NO_RESULTS' "$BASE/api/threats"
req "detections before a run" 409 'NO_RESULTS' "$BASE/api/detections"
req "summary before a run" 409 'NO_RESULTS' "$BASE/api/summary"

req "start decision tree" 202 '"state":"running"' -X POST "$BASE/api/detect" -d '{"model":"decision_tree"}'
wait_job
req "tree job finished" 200 '"state":"done"' "$BASE/api/detect/status"
req "start knn" 202 '"state":"running"' -X POST "$BASE/api/detect" -d '{"model":"knn","params":{"k":5}}'
wait_job
req "knn job finished" 200 '"state":"done"' "$BASE/api/detect/status"

req "metrics (both models)" 200 '"available":\["decision_tree","knn"\]' "$BASE/api/metrics"
req "dashboard" 200 '"attackTypes"' "$BASE/api/dashboard?model=knn"
req "threats" 200 '"items"' "$BASE/api/threats?model=decision_tree&pageSize=5"
req "summary" 200 '"classCounts"' "$BASE/api/summary?model=knn"
req "detections (all rows)" 200 '"isMalicious"' "$BASE/api/detections?model=knn"
req "detections: normal only" 200 '"filter":"normal"' "$BASE/api/detections?model=knn&filter=normal"
req "detections: threats only" 200 '"filter":"threats"' "$BASE/api/detections?model=knn&filter=threats"
req "detections: bad filter" 400 'filter' "$BASE/api/detections?filter=maybe"
req "severity is off by default" 400 'not enabled' "$BASE/api/threats?severity=High"
req "threats: filters" 200 '"total"' "$BASE/api/threats?model=knn&attackType=DoS&sort=confidence&order=desc"
req "threats: bad page size" 400 'pageSize' "$BASE/api/threats?pageSize=999999"
first=$(curl -s "$BASE/api/threats?model=knn&pageSize=1" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
req "threat detail" 200 '"features"' "$BASE/api/threats/${first:-0}?model=knn"
req "threat detail: not a threat" 404 'NOT_FOUND' "$BASE/api/threats/99999999?model=knn"
req "detection detail" 200 '"features"' "$BASE/api/detections/0?model=knn"

req "complexity before run" 200 '"ready":false' "$BASE/api/complexity"
req "complexity: bad fraction" 400 'fraction' -X POST "$BASE/api/complexity/run" -d '{"fractions":[0]}'
req "start complexity" 202 '"state":"running"' -X POST "$BASE/api/complexity/run" -d '{"fractions":[0.25,1.0]}'
wait_job
req "complexity result" 200 '"ready":true' "$BASE/api/complexity"
req "complexity: memory is null, not invented" 200 '"memoryBytes":null' "$BASE/api/complexity"
req "unknown endpoint" 404 'NOT_FOUND' "$BASE/api/nothing"

echo
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
