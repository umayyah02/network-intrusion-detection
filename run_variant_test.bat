@echo off
rem Leave-one-variant-out test. Run from the project folder (where tune_knn.exe and tune_tree.exe are).
rem Needs the files in this folder's data\ copied to your project's data\ folder.
if not exist variant_results mkdir variant_results
for %%V in (Hulk GoldenEye DDoS FTP WebBF) do (
  echo Running held-out %%V ...
  tune_knn data\A2_minus_%%V.csv final all 1 1 0 data\held_%%V.csv > variant_results\knn_%%V.txt
  tune_tree data\A2_minus_%%V.csv final all 0 2 data\held_%%V.csv > variant_results\tree_%%V.txt
)
echo Done. Results are in variant_results\
