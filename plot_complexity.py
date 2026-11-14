
import csv
import json
import math
import matplotlib.pyplot as plt


# Load experiment metadata
with open("complexity_metadata_A3.json", "r") as file:
    metadata = json.load(file)

required_metadata = {
    "dataset", "repetitions", "cpu", "ram", "features"
}

if not required_metadata.issubset(metadata):
    raise ValueError("Metadata file is missing required fields.")

dataset = metadata["dataset"]
repetitions = metadata["repetitions"]
cpu = metadata["cpu"]
ram = metadata["ram"]
FEATURES = metadata["features"]


# Load experiment results
data = []

with open("complexity_results_A3.csv", newline="") as file:
    reader = csv.DictReader(file)

    required_columns = {
        "model", "rows", "trainSeconds", "predictSeconds"
    }

    if not required_columns.issubset(reader.fieldnames or []):
        raise ValueError("CSV is missing required columns.")

    for row in reader:
        data.append({
            "model": row["model"],
            "rows": int(row["rows"]),
            "trainSeconds": float(row["trainSeconds"]),
            "predictSeconds": float(row["predictSeconds"])
        })

if not data:
    raise ValueError("No experiment results found in CSV.")


models = {
    "decision_tree": "Decision Tree",
    "knn": "KNN"
}


def theoretical_growth(rows, complexity):
    values = []

    for n in rows:
        if complexity == "nlogn":
            values.append(n * FEATURES * math.log2(n))
        elif complexity == "n":
            values.append(n * FEATURES)

    return values


def normalize_curve(theoretical, measured):
    if not theoretical or not measured or theoretical[-1] == 0:
        raise ValueError("Cannot normalize an empty or zero-valued curve.")

    scale = measured[-1] / theoretical[-1]

    return [value * scale for value in theoretical]


def graph_title(title):
    return (
        f"{title}\n"
        f"{dataset} Dataset | Average of {repetitions} Runs\n"
        f"{cpu} | {ram} RAM"
    )


# Graph 1: Training time
plt.figure()

for model, name in models.items():
    results = [r for r in data if r["model"] == model]
    results.sort(key=lambda r: r["rows"])

    if not results:
        continue

    rows = [r["rows"] for r in results]
    times = [r["trainSeconds"] for r in results]

    plt.plot(rows, times, marker="o", label=name)

    if model == "decision_tree":
        theory = theoretical_growth(rows, "nlogn")
        theory = normalize_curve(theory, times)

        plt.plot(
            rows,
            theory,
            linestyle="--",
            marker="x",
            label="Decision Tree O(n f log n) - normalized"
        )

plt.xlabel("Training Records")
plt.ylabel("Training Time (seconds)")
plt.title(graph_title("Training Time vs Training Data Size"))
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("complexity_training.png", dpi=300)
plt.close()


# Graph 2: Prediction time
plt.figure()

for model, name in models.items():
    results = [r for r in data if r["model"] == model]
    results.sort(key=lambda r: r["rows"])

    if not results:
        continue

    rows = [r["rows"] for r in results]
    times = [r["predictSeconds"] for r in results]

    plt.plot(rows, times, marker="o", label=name)

    if model == "knn":
        theory = theoretical_growth(rows, "n")
        theory = normalize_curve(theory, times)

        plt.plot(
            rows,
            theory,
            linestyle="--",
            marker="x",
            label="KNN O(n f) - normalized"
        )

plt.xlabel("Training Records")
plt.ylabel("Prediction Time (seconds, log scale)")
plt.title(graph_title("Prediction Time vs Training Data Size"))
plt.yscale("log")
plt.legend()
plt.grid(True, which="both")
plt.tight_layout()
plt.savefig("complexity_prediction.png", dpi=300)
plt.close()


# Growth-ratio analysis
growth_results = []

for model, name in models.items():
    results = [r for r in data if r["model"] == model]
    results.sort(key=lambda r: r["rows"])

    for metric in ["trainSeconds", "predictSeconds"]:
        for i in range(1, len(results)):
            previous = results[i - 1]
            current = results[i]

            previous_time = previous[metric]
            current_time = current[metric]

            size_ratio = current["rows"] / previous["rows"]

            time_ratio = (
                current_time / previous_time
                if previous_time > 0 else None
            )

            growth_results.append({
                "model": model,
                "metric": metric,
                "previousRows": previous["rows"],
                "currentRows": current["rows"],
                "datasetSizeRatio": round(size_ratio, 3),
                "executionTimeRatio": (
                    round(time_ratio, 3)
                    if time_ratio is not None else ""
                )
            })


with open("complexity_growth_ratios_A3.csv", "w", newline="") as file:
    fieldnames = [
        "model",
        "metric",
        "previousRows",
        "currentRows",
        "datasetSizeRatio",
        "executionTimeRatio"
    ]

    writer = csv.DictWriter(file, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(growth_results)


# Display results
print("Both complexity graphs generated successfully.")
print("Growth-ratio analysis saved successfully.")

print("\nGrowth-ratio analysis:")

for result in growth_results:
    print(
        f'{result["model"]} | {result["metric"]} | '
        f'{result["previousRows"]} -> {result["currentRows"]} rows | '
        f'Dataset x{result["datasetSizeRatio"]} | '
        f'Execution time x{result["executionTimeRatio"]}'
    )
