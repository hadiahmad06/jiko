# Sprint 2 plan

**Premise:** Sprint 1 delivered the loop (device → sync → trigger → message → talk-back) on macOS with a Postgres backend. Sprint 2 makes it something a second person could live with for a week.

## Goal

> A friend installs the macOS agent, answers three questions, and a week later has received a handful of nudges that were *right*, one nightly line per day, and never felt nagged.

## Backlog, in order

### A. Delivery that feels like a text (the pitch)
1. **iMessage via the Mac agent.** Messages.app can send to yourself via AppleScript (`tell application "Messages" to send ... to buddy ...`). The agent already receives queued messages; add a `delivery_channel = imessage` that the agent honours by sending to the user's own number. Needs Automation permission, which the onboarding should ask for. Replies come back through the notification reply box for now.
2. **SMS via SNS** already exists behind `delivery_channel = sms`; verify with a real number and add an inbound webhook (`POST /webhooks/sms`) so replies over SMS reach talk-back.
3. **Escalation, not repetition.** When a trigger would fire again after being ignored (no inbound since last nudge), pick a *different* line: presets get a `messages: string[]` array and the engine rotates by `fire_count`. A third ignored nudge should say less, not more.

### B. Knowing why (obligations fill themselves)
4. **Calendar subscription.** `POST /obligations/import/ics` exists (Sprint 1 stretch). Add a stored ICS URL per user + a daily scheduled re-import; Canvas and Google Calendar both export ICS URLs. That covers most students without OAuth.
5. **Goals as obligations.** `kind = goal` rows exist but nothing evaluates them. Add a `goal_progress` condition (minutes logged for `activity_id` in the last `timeframe_days` vs `target_minutes`) and a weekly preset: "you said 3h of reading a week. it's thursday and you're at 40 min."
6. **Weekly reflection.** Sunday night scheduled trigger: one question ("what worked this week?"). Store the reply with `metadata.kind = reflection`; reference it in the following week's morning check-in.

### C. Knowing you (signals beyond app time)
7. **iOS agent, minimal.** Location sync via `CLLocationManager` significant-change updates + HealthKit steps/sleep read once an hour. No Screen Time yet (needs FamilyControls entitlement approval; apply for it this sprint, build next). Reuse `JikoSync` ObjC lib or port `JikoAPI.swift` to a shared Swift package; the Swift package is the better bet.
8. **Sleep-aware strictness.** Health condition `health_metric sleep_minutes < 300` in the doomscroll preset lowers the tone: `voice` gets a "tired" hint. Cheap once health data flows.
9. **Focus-mode awareness on macOS.** Read `~/Library/DoNotDisturb/DB/Assertions.json` (or `defaults`) to know when a Focus is on; treat it as quiet hours.

### D. Voice
10. **Own-voice fine-tune, properly scoped.** The `training/` pipeline splits iMessage exports into subconversations. Sprint 2 only ships the *style extraction*: sample 200 of the user's own messages, summarise their texting style into a 300-word style guide stored in `user_preferences.voice_guide`, and pass it as the `own_voice` system prompt. No model training, no message upload beyond the style guide.
11. **Live LLM eval.** Ten canned situations × five voices, graded by a rubric (one or two sentences, no facts invented, no emoji, on the user's side). Run before and after prompt changes.

### E. Hygiene
12. **Deploy.** Dockerfile for the backend, RDS + one small instance or Fly.io, GitHub Actions deploy on `main`. Scheduler on exactly one instance.
13. **Launch at login** for the macOS agent (`SMAppService`).
14. **Rate limiting and payload caps** on `/sync/*` and `/messages` (express-rate-limit).
15. **Trigger UI polish**: show the last firing's reason in Rules; a "why did I get this?" link from each message to its firing.

## Explicitly not in Sprint 2
- Focus groups / social features.
- Android.
- App blocking of any kind.
- A web dashboard.

## Definition of done
- Someone other than Hadi runs the agent for five days; their transcript (`GET /messages`) shows ≤ budget nudges per day, at least one nudge they replied to, and a nightly line every night.
- iOS agent posts location and health; a location preset fires on a real geofence.
- Own-voice style guide produced from a real export and used in at least one nudge.
