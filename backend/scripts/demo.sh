#!/usr/bin/env bash
# End-to-end demo against a running backend (default http://localhost:3000).
# Creates a throwaway user, labels Instagram as distracting, adds a deadline,
# turns on the deadline-drift rule, fakes 25 minutes of Instagram, and shows
# the message Jiko queued. Then talks back.
set -euo pipefail
BASE="${JIKO_URL:-http://localhost:3000}"
PHONE="+1555$(printf '%07d' $((RANDOM * RANDOM % 10000000)))"
j() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer ${TOKEN:-}" "$@"; }
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

step "1. signup ($PHONE)"
SIGNUP=$(j -X POST "$BASE/auth/signup" -d "{\"phone_number\":\"$PHONE\",\"password\":\"Password123!\",\"nickname\":\"demo\"}")
TOKEN=$(echo "$SIGNUP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
echo "token ok"

step "2. preferences: no quiet hours for the demo, timezone = $(date +%Z)"
j -X PATCH "$BASE/users/preferences" -d '{"quiet_hours":{"start":"03:00","end":"03:01"},"strictness":0.6}' | python3 -c 'import sys,json;p=json.load(sys.stdin);print("budget/day:",p["interrupt_budget_per_day"])'

step "3. label instagram as distracting"
j -X PUT "$BASE/usage/apps/labels" -d '{"labels":[{"bundle_id":"com.burbn.instagram","label":"distracting"}]}' >/dev/null && echo ok

step "4. quick-add an obligation"
j -X POST "$BASE/obligations/quick" -d '{"text":"OS midterm in 6 hours"}' | python3 -c 'import sys,json;o=json.load(sys.stdin);print(o["kind"],"->",o["title"],"due",o.get("due_at") or o.get("start_at"))'

step "5. enable the deadline_drift preset (20 min on distracting apps while something is due within 24h)"
j -X POST "$BASE/triggers/presets/deadline_drift" -d '{"minutes":20}' | python3 -c 'import sys,json;t=json.load(sys.stdin);print(t["name"],t["id"])'

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
ago() { date -u -v-"$1"M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "$1 minutes ago" +%Y-%m-%dT%H:%M:%SZ; }
usage() { echo "{\"timestamp\":\"$(now)\",\"platform\":\"macos\",\"device_id\":\"demo-mac\",\"log\":[{\"bundleId\":\"com.burbn.instagram\",\"appName\":\"Instagram\",\"timestamp\":\"$(now)\",\"startTime\":\"$(ago $1)\",\"durationSeconds\":$(( $1 * 60 )),\"isForeground\":true}]}"; }

step "6. sync 10 minutes of instagram (below threshold)"
j -X POST "$BASE/sync/app-usage" -d "$(usage 10)" | python3 -c 'import sys,json;print("triggered:",json.load(sys.stdin)["triggered_ids"])'

step "7. sync 15 more minutes (25 total in the last hour)"
j -X POST "$BASE/sync/app-usage" -d "$(usage 15)" | python3 -c 'import sys,json;r=json.load(sys.stdin);print("triggered:",r["triggered_ids"]);print("results:",r["firings"][0]["results"] if r["firings"] else "-")'

step "8. what did jiko say?"
MSG=$(j "$BASE/messages/queued")
echo "$MSG" | python3 -c 'import sys,json;[print("  jiko:",m["body"]) for m in json.load(sys.stdin)]'
MID=$(echo "$MSG" | python3 -c 'import sys,json;m=json.load(sys.stdin);print(m[0]["id"] if m else "")')

step "9. talk back: 'snooze 30'"
j -X POST "$BASE/messages" -d "{\"body\":\"snooze 30\",\"reply_to_id\":\"$MID\"}" | python3 -c 'import sys,json;r=json.load(sys.stdin);print("  intent:",r["intent"]);print("  jiko:",r["reply"]);print("  effects:",r["effects"])'

step "10. 'status'"
j -X POST "$BASE/messages" -d '{"body":"status"}' | python3 -c 'import sys,json;print("  jiko:",json.load(sys.stdin)["reply"])'

step "11. today's summary"
j "$BASE/usage/summary" | python3 -c 'import sys,json;print("  ",json.load(sys.stdin)["text"])'

step "done. clean up with: curl -X DELETE $BASE/users -H 'Authorization: Bearer <token>'"
