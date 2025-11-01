from datetime import datetime
from collections import defaultdict
import numpy as np

from datetime import datetime
from collections import defaultdict
import numpy as np

def split_conversations(messages, 
                        base_threshold_multiplier=3.0,
                        min_messages_per_snippet=3,
                        max_messages_per_snippet=20,
                        max_gap_seconds=3600):
    """
    Split messages into subconversations using adaptive time thresholds,
    max/min message constraints, and merging logic.
    Returns a list of message lists.
    """
    grouped = defaultdict(list)
    for msg in messages:
        key = msg.get("conversation") or msg.get("receiver") or "group"
        grouped[key].append(msg)
    
    all_snippets = []

    for chat_msgs in grouped.values():
        # Remove messages with invalid timestamps
        valid_msgs = []
        times = []
        for m in chat_msgs:
            try:
                t = datetime.fromisoformat(m["timestamp"])
                times.append(t)
                valid_msgs.append(m)
            except Exception:
                continue

        if len(valid_msgs) < 2:
            all_snippets.append(valid_msgs)
            continue

        # sort by time
        sorted_pairs = sorted(zip(valid_msgs, times), key=lambda x: x[1])
        chat_msgs, times = zip(*sorted_pairs)
        chat_msgs = list(chat_msgs)
        times = list(times)

        # compute gaps
        gaps = [(times[i] - times[i-1]).total_seconds() for i in range(1, len(times))]
        gaps = [g for g in gaps if g >= 0]

        median_gap = np.median(gaps) if gaps else 0
        dynamic_threshold = max(median_gap * base_threshold_multiplier, 1)
        threshold = min(dynamic_threshold, max_gap_seconds)

        # find split points
        split_indices = [i for i, g in enumerate(gaps, start=1) if g > threshold]

        # split by gaps
        snippets = []
        start = 0
        for idx in split_indices:
            snippets.append(chat_msgs[start:idx])
            start = idx
        snippets.append(chat_msgs[start:])

        # enforce max_messages_per_snippet
        refined = []
        for s in snippets:
            for i in range(0, len(s), max_messages_per_snippet):
                refined.append(s[i:i+max_messages_per_snippet])

        # merge tiny snippets
        merged = []
        buffer = []
        for s in refined:
            if len(s) < min_messages_per_snippet:
                buffer.extend(s)
            else:
                if buffer:
                    merged.append(buffer + s)
                    buffer = []
                else:
                    merged.append(s)
        if buffer:
            merged.append(buffer)

        all_snippets.extend(merged)

    return all_snippets