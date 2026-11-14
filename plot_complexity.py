import csv
import matplotlib.pyplot as plt

data = []

with open("complexity_results_A3.csv", newline="") as file:
    reader = csv.DictReader(file)

    for row in reader:
        data.append({
            "model": row["model"],
            "rows": int(row["rows"]),
            "trainSeconds": float(row["trainSeconds"]),
            "predictSeconds": float(row["predictSeconds"])
        })

models = {
    "decision_tree": "Decision Tree",
    "knn": "KNN"
}

# Graph 1: Training time
for model, name in models.items():
    results = [r for r in data if r["model"] == model]
    results.sort(key=lambda r: r["rows"])

    plt.plot(
        [r["rows"] for r in results],
        [r["trainSeconds"] for r in results],
        marker="o",
        label=name
    )

plt.xlabel("Training Records")
plt.ylabel("Training Time (seconds)")
plt.title("Training Time vs Training Data Size\nA3 Dataset | Average of 3 Runs")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig("complexity_training.png", dpi=300)
plt.close()

# Graph 2: Prediction time
for model, name in models.items():
    results = [r for r in data if r["model"] == model]
    results.sort(key=lambda r: r["rows"])

    plt.plot(
        [r["rows"] for r in results],
        [r["predictSeconds"] for r in results],
        marker="o",
        label=name
    )

plt.xlabel("Training Records")
plt.ylabel("Prediction Time (seconds, log scale)")
plt.title("Prediction Time vs Training Data Size\nA3 Dataset | Average of 3 Runs")
plt.yscale("log")
plt.legend()
plt.grid(True, which="both")
plt.tight_layout()
plt.savefig("complexity_prediction.png", dpi=300)
plt.close()

print("Both complexity graphs generated successfully.")