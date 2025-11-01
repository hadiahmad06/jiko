from bs4 import BeautifulSoup
from datetime import datetime
import json
import os

def parse_imessage_html(file_path, base_name, receiver=None):
    """
    Parse an exported iMessage HTML file and extract sender, timestamp, and content.
    Returns a list of message dicts ready for JSON serialization.
    """

    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    messages = []

    # loop through all message containers
    for msg in soup.find_all("div", class_="message"):
        # find elements
        sender_tag = msg.find("span", class_="sender")
        timestamp_tag = msg.find("span", class_="timestamp")
        bubble_tag = msg.find("span", class_="bubble")

        # skip if any field missing (not a proper message)
        if not (sender_tag and timestamp_tag and bubble_tag):
            continue

        # clean timestamp (convert to ISO 8601)
        raw_time = timestamp_tag.get_text(strip=True).split('(')[0].strip()
        try:
            # try parsing like: "Jun 06, 2025  7:59:51 PM"
            dt = datetime.strptime(raw_time, "%b %d, %Y %I:%M:%S %p")
            iso_time = dt.isoformat()
        except ValueError:
            iso_time = raw_time  # fallback to raw if format unexpected

        message_data = {
            "platform": "imessage",
            "conversation": base_name,
            "sender": sender_tag.get_text(strip=True),
            "timestamp": iso_time,
            "content": bubble_tag.get_text(strip=True)
        }

        # add receiver only if provided (1-on-1 chat)
        if receiver:
            if message_data["sender"] == receiver:
                message_data["receiver"] = "self"
            else:
                message_data["receiver"] = receiver
        

        messages.append(message_data)

    return messages


def parse_imessage_folder(folder_path, limit=0, skip=0):
    """
    Parse all .html iMessage files in a folder using parse_imessage_html.
    limit: maximum number of files to parse (0 = no limit)
    skip: number of initial files to skip
    """
    all_messages = []

    files = [f for f in os.listdir(folder_path) if f.endswith(".html")]
    files.sort()

    # Apply skip and limit
    if skip > 0:
        files = files[skip:]
    if limit > 0:
        files = files[:limit]

    for i, filename in enumerate(files, start=1):
        import re
        base_name = os.path.splitext(filename)[0]
        receiver = None
        chat_type = "GM"
        if re.match(r"^\+\d+$", base_name) or "@" in base_name:
            receiver = base_name
            chat_type = "DM"

        print(f"[{i}/{len(files)}] Parsing {chat_type} - {base_name}")

        file_path = os.path.join(folder_path, filename)

        try:
            messages = parse_imessage_html(file_path, base_name=base_name, receiver=receiver)
            all_messages.extend(messages)
        except Exception as e:
            print(f"Error parsing {filename}: {e}")

    return all_messages



# Example usage:
if __name__ == "__main__":
    data = parse_imessage_folder("imessage/", limit=0, skip=0)
    # data = parse_imessage_html("imessage/+12014623980.html", receiver="+17633272678")
    # print(json.dumps(data, indent=4))