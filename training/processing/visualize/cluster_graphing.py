import matplotlib.pyplot as plt
import numpy as np
from datetime import datetime
import json

def plot_cluster_statistics(conversations):
    """
    conversations: list of lists of messages (output from split_conversations)
    Each message must have a 'timestamp' in ISO format
    """

    x_vals = []  # number of messages
    y_vals = []  # median time between messages in minutes

    for convo in conversations:
        if len(convo) < 2:
            continue  # skip single-message clusters

        # parse timestamps
        timestamps = []
        for msg in convo:
            try:
                timestamps.append(datetime.fromisoformat(msg["timestamp"]))
            except Exception:
                continue

        if len(timestamps) < 2:
            continue

        # compute time gaps in minutes
        gaps = [(timestamps[i] - timestamps[i - 1]).total_seconds() / 60 for i in range(1, len(timestamps))]
        median_gap = np.median(gaps)

        x_vals.append(len(convo))
        y_vals.append(median_gap)

    # create scatter plot
    plt.figure(figsize=(10, 6))
    plt.scatter(x_vals, y_vals, alpha=0.6)
    plt.xlabel("Number of messages in snippet")
    plt.yscale("log")
    plt.ylabel("Median time between messages (minutes, log scale)")
    plt.title("Cluster Analysis: #Messages vs Median Time Between Messages")
    plt.grid(True)
    plt.show()


# Example usage
if __name__ == "__main__":
    from ..clustering import split_conversations

    # Load subconversations from JSON
    import json
    with open("subconversations.json", "r", encoding="utf-8") as f:
        subconversations = json.load(f)

    # Plot cluster statistics
    plot_cluster_statistics(subconversations)