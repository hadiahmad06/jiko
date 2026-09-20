"""Split an export into subconversations. Kept from the fine-tune plan that
Sprint 2 scoped down to style extraction; see training/README.md."""

import json

from processing.parsing.imessage import parse_imessage_folder
from experiments.clustering import split_conversations

def main():
    folder_path = "imessage/"
    data = parse_imessage_folder(folder_path, limit=10, skip=25)
    subconversations = split_conversations(data)
    print(json.dumps(subconversations, indent=2))

    with open("subconversations.json", "w", encoding="utf-8") as f:
        json.dump(subconversations, f, ensure_ascii=False, indent=2)
    # print(f"Parsed {len(data)} total messages")

if __name__ == "__main__":
    main()