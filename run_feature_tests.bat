@echo off
rem Feature-set test (Member 1's plan). Run from the project folder, after rebuilding tune_knn and tune_tree.
rem Needs the A2_minus_* and held_* files from variant_test.zip in data\ (plus sample_A2, sample_V, sample_C).
rem Settings are held at the values chosen for "all" (KNN Manhattan K=1, tree unlimited depth minLeaf 2),
rem so only the feature set changes. Nothing is retuned on the held-out data.
set OUT=variant_feature_results.txt
if exist %OUT% del %OUT%

for %%S in (notcp top5 top10) do (
  for %%V in (Hulk GoldenEye DDoS FTP WebBF) do (
    echo ##### KNN %%S held-out %%V >> %OUT%
    tune_knn data\A2_minus_%%V.csv final %%S 1 1 0 data\held_%%V.csv >> %OUT% 2>&1
    echo ##### TREE %%S held-out %%V >> %OUT%
    tune_tree data\A2_minus_%%V.csv final %%S 0 2 data\held_%%V.csv >> %OUT% 2>&1
  )
  echo ##### KNN %%S full-A2 with V and C >> %OUT%
  tune_knn data\sample_A2.csv final %%S 1 1 0 data\sample_V.csv data\sample_C.csv >> %OUT% 2>&1
  echo ##### TREE %%S full-A2 with V and C >> %OUT%
  tune_tree data\sample_A2.csv final %%S 0 2 data\sample_V.csv data\sample_C.csv >> %OUT% 2>&1
)

rem Reference baseline: port + duration, with the settings chosen for it earlier (KNN K=5, tree depth 6, minLeaf 2).
rem Its V and C results already exist, so only the held-out variants are run here.
for %%V in (Hulk GoldenEye DDoS FTP WebBF) do (
  echo ##### KNN portdur held-out %%V >> %OUT%
  tune_knn data\A2_minus_%%V.csv final portdur 1 5 0 data\held_%%V.csv >> %OUT% 2>&1
  echo ##### TREE portdur held-out %%V >> %OUT%
  tune_tree data\A2_minus_%%V.csv final portdur 6 2 data\held_%%V.csv >> %OUT% 2>&1
)
echo Done. Send me %OUT%
