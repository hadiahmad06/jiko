# Sprint 3 plan

**Premise:** Sprint 2 made Jiko something a second person could live with: it reaches you where your friends do, it knows why it interrupted, and it can be deployed. Nothing has been through a week of real use by anyone but Hadi. Sprint 3 is about running it for real, on a server, for more than one person, and cutting whatever the first week proves is wrong.

## Goal

> Two people run Jiko for a week against a deployed backend. At the end, each can point at one nudge that changed what they did that day, and neither can point at a nudge that made them want to uninstall it.

## Backlog, in order

### A. Actually running (the part with no code to hide behind)
1. **Deploy it.** `fly launch` against the existing `fly.toml`, a Postgres attached, `FLY_API_TOKEN` in the repository secrets so `main` deploys itself. Point the macOS agent's server field at it. Everything after this item assumes a real base URL, not `localhost:3000`.
2. **Two real users for five days.** Hadi plus one friend. Success is measured from `GET /messages`: ≤ budget nudges per day, at least one reply, a nightly line every night. Log what each of them says about a nudge that missed, verbatim, in a `FIELD_NOTES.md` — the quotes are the input to item 6.
3. **SMS end to end with a real number.** Two-way SMS on AWS End User Messaging, the origination number registered, `POST /webhooks/sms` subscribed to the SNS topic, `JIKO_SMS_WEBHOOK_SECRET` set. The code path is written and tested against the SNS envelope; what is untested is the AWS side.
4. **Backups and a restore rehearsal.** A nightly `pg_dump` to object storage, and one actual restore into a scratch database. A system holding a person's messages and location that has never been restored is not backed up.

### B. Apple's paperwork
5. **FamilyControls entitlement.** Apply, and while waiting, build the iOS Screen Time path behind a flag: `DeviceActivityMonitor` reporting per-category minutes into `/sync/app-usage`. Ship it the day the entitlement lands; if it is refused, iOS stays location + health and the doomscroll rules stay a Mac feature.

### C. What the first week proves
6. **Cut the presets that misfire.** Whatever item 2's field notes show. The likely candidates: `late_night` (fires when you are deliberately up late), `morning_checkin` (says nothing useful when nothing is due), `deadline_drift` at low strictness. Deleting a preset is a valid outcome and cheaper than tuning it.
7. **A "that was wrong" button.** One tap on a nudge records `metadata.feedback = 'wrong'` against its firing. Then: a weekly digest of wrong nudges per trigger, and a trigger that collects three of them in a week disables itself and says so. This is the smallest honest version of learning.
8. **Budget that adapts.** Today the interrupt budget is a fixed number per day. Make it spend less on days the user has been replying "ok" (acknowledged but unchanged) and more on days with a real deadline. Bounded by the user's setting, never above it.

### D. The parts that are still stubs
9. **Location rules on iOS.** The iOS agent posts fixes but the app has no UI for saving a place, so `preset:arrive` / `preset:leave` cannot be created from the phone. Add a "save this place" screen backed by `POST /locations`, and the two location presets in the iOS Rules tab.
10. **A Rules tab on iOS.** Parity with the macOS Rules list: what is on, what it last fired for, enable/disable, and the preset list.
11. **Retire `SPRINT_PLAN.md`'s dead ends.** `training/` still carries the subconversation clustering pipeline from the fine-tune idea that Sprint 2 scoped down to style extraction. Either delete it or move it under `training/experiments/` with a README saying what it was for.

### E. Hygiene
12. **`GET /messages` pagination.** `limit` caps at 200 and there is no cursor. A month of use makes the conversation view slow and the LLM context expensive.
13. **Structured logs.** `console.log` everywhere is fine on one machine and useless on three. One JSON line per request and per firing, with the user id, so a "why did nothing fire?" question can be answered from logs instead of a database query.
14. **The eval in CI, on a schedule.** `npm run eval:voice` weekly against the deployed model, posting the pass rate. Not on every push: it costs real money and the failures are rarely caused by the diff.

## Explicitly not in Sprint 3
- Android.
- A web dashboard.
- App blocking.
- Social features of any kind.
- Fine-tuning a model on the user's messages. The style guide is the scoped version and it is enough.

## Definition of done
- The backend has been serving two people from a real URL for five consecutive days, with backups running and one restore rehearsed.
- `FIELD_NOTES.md` has at least ten verbatim reactions, and at least one preset was deleted or rewritten because of them.
- A wrong nudge can be marked wrong, and a trigger that keeps being wrong turns itself off.
- Either Screen Time works on iOS behind the entitlement, or the repository says plainly that it does not and why.
