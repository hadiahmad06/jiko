# training/

What Jiko learns from your own messages, and what it deliberately doesn't.

## What ships

**`processing/style_guide.py`** — reads an iMessage export, samples 200 of your
own messages, and writes a style guide: median length, capitalisation,
punctuation habits, emoji use, the filler words you actually use. That guide is
the whole product. It goes into `user_preferences.voice_guide` and becomes the
`own_voice` system prompt.

```bash
cd training
pip install beautifulsoup4
python -m processing.style_guide --folder imessage/ --stats

# send it to a running backend
python -m processing.style_guide --folder imessage/ --post http://localhost:3000 --token "$JIKO_TOKEN"

# optional: let Claude write the guide instead of the statistics (this uploads
# the sampled messages to the Anthropic API from your machine)
ANTHROPIC_API_KEY=... python -m processing.style_guide --folder imessage/ --llm
```

The default path makes **no network call at all**. `--llm` is the only mode
that sends message text anywhere, and `--post` sends the finished guide and
nothing else. No messages are uploaded to Jiko's backend, ever.

**`processing/parsing/imessage.py`** — the export reader both paths use.
Messages you sent have `sender == "Me"`.

## Your export

`imessage/`, `discord/`, `instagram/` and `subconversations.json` are
gitignored. They are your actual conversations; keep them that way.

## `experiments/`

`clustering.py`, `main.py` and `visualize/` are what remains of the original
plan: split an export into subconversations and fine-tune a model on them.
Sprint 2 cut that down to style extraction, because a 300-word prompt bought
most of the voice for none of the cost, the privacy exposure or the training
loop. The code is kept because the clustering is the interesting part and may
come back for something else — conversation-level features, not a fine-tune.
Nothing in `processing/` imports it.

```bash
python -m experiments.main    # writes subconversations.json
```
