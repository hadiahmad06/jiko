"""Build a short style guide from the user's own texts.

Sprint 2 ships style extraction only: no fine-tune, no message upload. The
output is a paragraph of instructions ("lowercase, rarely ends a sentence with
a period, says 'ngl'") that the backend stores in
`user_preferences.voice_guide` and passes as the `own_voice` system prompt.

Two modes:

    python -m processing.style_guide --folder imessage/          # local stats only
    python -m processing.style_guide --folder imessage/ --llm    # + Claude summary

The default never leaves the machine. `--llm` sends the sampled messages to the
Anthropic API to get a more natural write-up; `--post` sends only the finished
guide to a running Jiko backend.

Usage:
    python -m processing.style_guide --folder imessage/ --sample 200
    python -m processing.style_guide --folder imessage/ --post http://localhost:3000 --token "$JIKO_TOKEN"
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from collections import Counter

try:
    from parsing.imessage import parse_imessage_folder
except ImportError:  # running as a module from the repo root
    from processing.parsing.imessage import parse_imessage_folder

OWN_SENDER = "Me"

# Anything that is not the user's voice: one-time codes, links, attachments,
# reactions, and the "Loved ..." tapback echoes.
NOISE = re.compile(
    r"(https?://|www\.)"
    r"|\b\d{4,8}\b\s*(is your|verification|code)"
    r"|\b(code|otp|verification)\b.*\d{3,}"
    r"|^(loved|liked|disliked|laughed at|emphasized|questioned)\s"
    r"|attachment|image/|\.(jpg|jpeg|png|heic|mov|mp4|pdf)\b",
    re.I,
)

EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
WORD = re.compile(r"[a-zA-Z']+")

FILLERS = [
    "lol", "lmao", "ngl", "tbh", "fr", "bruh", "bro", "idk", "imo", "ig", "rn",
    "ok", "okay", "yeah", "yea", "nah", "bet", "wait", "alr", "ty", "np", "damn",
    "wtf", "istg", "prob", "probably", "honestly", "literally", "actually",
]


def own_messages(folder: str, limit: int = 0, skip: int = 0) -> list[str]:
    """Every message the user sent, cleaned of codes, links and tapbacks."""
    parsed = parse_imessage_folder(folder, limit=limit, skip=skip)
    out = []
    for m in parsed:
        if m.get("sender") != OWN_SENDER:
            continue
        text = (m.get("content") or "").strip()
        if not text or NOISE.search(text):
            continue
        out.append(text)
    return out


def sample(messages: list[str], n: int, seed: int = 7) -> list[str]:
    if len(messages) <= n:
        return list(messages)
    rng = random.Random(seed)
    return rng.sample(messages, n)


def measure(messages: list[str]) -> dict:
    """The countable half of a voice: length, case, punctuation, vocabulary."""
    if not messages:
        return {}
    lengths = [len(WORD.findall(m)) for m in messages]
    lower = sum(1 for m in messages if m == m.lower() and any(c.isalpha() for c in m))
    ends_period = sum(1 for m in messages if m.rstrip().endswith("."))
    has_emoji = sum(1 for m in messages if EMOJI.search(m))
    exclaims = sum(1 for m in messages if "!" in m)
    questions = sum(1 for m in messages if m.rstrip().endswith("?"))
    ellipses = sum(1 for m in messages if "..." in m)

    words = Counter(w.lower() for m in messages for w in WORD.findall(m))
    fillers = {f: words[f] for f in FILLERS if words[f]}
    openers = Counter(WORD.findall(m)[0].lower() for m in messages if WORD.findall(m))

    n = len(messages)
    return {
        "messages": n,
        "median_words": sorted(lengths)[n // 2],
        "mean_words": round(sum(lengths) / n, 1),
        "share_under_5_words": round(sum(1 for l in lengths if l < 5) / n, 2),
        "share_all_lowercase": round(lower / n, 2),
        "share_ending_in_period": round(ends_period / n, 2),
        "share_with_emoji": round(has_emoji / n, 2),
        "share_with_exclamation": round(exclaims / n, 2),
        "share_questions": round(questions / n, 2),
        "share_with_ellipsis": round(ellipses / n, 2),
        "top_fillers": dict(sorted(fillers.items(), key=lambda kv: -kv[1])[:12]),
        "top_openers": dict(openers.most_common(8)),
    }


def guide_from_stats(stats: dict) -> str:
    """A style guide written from the numbers alone. No API call, no upload."""
    if not stats:
        return ""
    lines = []
    lines.append(
        f"Write the way this person texts. Their median message is {stats['median_words']} words; "
        f"{int(stats['share_under_5_words'] * 100)}% of what they send is under five words. Keep it that short."
    )
    if stats["share_all_lowercase"] > 0.6:
        lines.append("They write in lowercase almost always. Do not capitalise sentences or proper nouns unless they do.")
    elif stats["share_all_lowercase"] > 0.25:
        lines.append("They mix lowercase and normal capitalisation, leaning lowercase.")
    else:
        lines.append("They capitalise normally.")

    if stats["share_ending_in_period"] < 0.2:
        lines.append("They rarely end a message with a period. Leave it off.")
    if stats["share_with_exclamation"] < 0.1:
        lines.append("They almost never use exclamation marks.")
    elif stats["share_with_exclamation"] > 0.35:
        lines.append("They use exclamation marks freely.")

    if stats["share_with_emoji"] < 0.05:
        lines.append("They do not use emoji. Never add one.")
    elif stats["share_with_emoji"] > 0.3:
        lines.append("They use emoji often, usually one at the end.")

    if stats["share_with_ellipsis"] > 0.15:
        lines.append("They use '...' to trail off.")

    fillers = list(stats["top_fillers"])[:8]
    if fillers:
        lines.append("Words they actually use: " + ", ".join(fillers) + ". Use them the way they do, sparingly.")

    openers = [w for w in stats["top_openers"] if len(w) > 1][:5]
    if openers:
        lines.append("They often open with: " + ", ".join(openers) + ".")

    lines.append("Never imitate anything they only said once. When in doubt, write less.")
    return " ".join(lines)


LLM_PROMPT = """Below are real text messages written by one person. Write a style guide
that another writer could follow to sound like them in a short text message.

Cover: sentence length, capitalisation, punctuation habits, emoji use, slang and filler
words they actually use, how they open and close messages, and how they sound when annoyed
or when agreeing. Be concrete and quote short fragments as examples.

Hard rules for your output:
- At most 300 words, one paragraph plus short bullet lines if needed.
- Describe style only. Do not repeat any personal facts, names, numbers or events.
- Write it as instructions to the writer ("keep it lowercase", not "he keeps it lowercase").

MESSAGES:
{messages}"""


def guide_from_llm(messages: list[str], model: str | None = None) -> str:
    """Optional: ask Claude for a more natural write-up. Sends the samples."""
    try:
        from anthropic import Anthropic
    except ImportError:
        print("anthropic package not installed; run: pip install anthropic", file=sys.stderr)
        return ""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is not set; skipping the LLM pass.", file=sys.stderr)
        return ""
    client = Anthropic()
    body = "\n".join(f"- {m}" for m in messages)
    res = client.messages.create(
        model=model or os.environ.get("JIKO_LLM_MODEL", "claude-opus-5"),
        max_tokens=800,
        messages=[{"role": "user", "content": LLM_PROMPT.format(messages=body)}],
    )
    return "".join(b.text for b in res.content if b.type == "text").strip()


def post_guide(base_url: str, token: str, guide: str) -> int:
    """PATCH /users/preferences { voice: 'own_voice', voice_guide }."""
    import urllib.request

    payload = json.dumps({"voice": "own_voice", "voice_guide": guide}).encode()
    req = urllib.request.Request(
        base_url.rstrip("/") + "/users/preferences",
        data=payload,
        method="PATCH",
        headers={"content-type": "application/json", "authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as res:
        return res.status


def main() -> int:
    ap = argparse.ArgumentParser(description="Build a voice_guide from an iMessage export.")
    ap.add_argument("--folder", default="imessage/", help="folder of exported .html chats")
    ap.add_argument("--sample", type=int, default=200, help="how many of your own messages to look at")
    ap.add_argument("--llm", action="store_true", help="also ask Claude to write the guide (uploads the samples)")
    ap.add_argument("--stats", action="store_true", help="print the measured numbers too")
    ap.add_argument("--post", metavar="BASE_URL", help="PATCH the guide to a running Jiko backend")
    ap.add_argument("--token", default=os.environ.get("JIKO_TOKEN", ""), help="bearer token for --post")
    ap.add_argument("--out", help="write the guide to this file")
    args = ap.parse_args()

    messages = own_messages(args.folder)
    if not messages:
        print(f"no messages from '{OWN_SENDER}' found in {args.folder}", file=sys.stderr)
        return 1
    picked = sample(messages, args.sample)
    stats = measure(picked)
    guide = guide_from_llm(picked) if args.llm else ""
    if not guide:
        guide = guide_from_stats(stats)

    if args.stats:
        print(json.dumps(stats, indent=2))
        print()
    print(guide)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(guide + "\n")

    if args.post:
        if not args.token:
            print("--post needs --token (or JIKO_TOKEN)", file=sys.stderr)
            return 1
        status = post_guide(args.post, args.token, guide)
        print(f"posted to {args.post}: HTTP {status}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
