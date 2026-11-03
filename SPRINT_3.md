# Sprint 3 plan

**Status (2026-11-03):** the project sat untouched from 2026-09-20 to 2026-11-03; nothing ran in that gap, and the sprint resumes from where it stopped. The items that need no human are done — feedback and auto-disable (7), the adaptive budget (8), iOS places and Rules (9, 10), the `training/` cleanup (11), pagination (12), structured logs (13), the scheduled eval (14), and backup and restore (4). Item 1 is done: the backend runs on a self-hosted Oracle Cloud ARM VM rather than Fly (see D37), serving `https://64-181-196-147.sslip.io` from a real database with nightly backups; the certificate was issued 2026-09-20 and runs to 2026-12-19, renewed by Caddy as long as the VCN ingress rules for 80/443 stay in place. What remains is the part with a person in it: the five-day run (2) is next and starts from `FIELD_NOTES.md`, then AWS's side of SMS (3) and Apple's entitlement (5). Item 6 depends on item 2's field notes by definition.

**Premise:** Sprint 2 made Jiko something a second person could live with: it reaches you where your friends do, it knows why it interrupted, and it can be deployed. Nothing has been through a week of real use by anyone but Hadi. Sprint 3 is about running it for real, on a server, for more than one person, and cutting whatever the first week proves is wrong.

## Goal

> Two people run Jiko for a week against a deployed backend. At the end, each can point at one nudge that changed what they did that day, and neither can point at a nudge that made them want to uninstall it.

## Backlog, in order

### A. Actually running (the part with no code to hide behind)
1. **Deploy it.** ✅ (serving over HTTPS) Not Fly — a self-hosted Oracle Cloud always-free ARM VM, Node 22 + PostgreSQL 16 + PostGIS from packages, the API under systemd, Caddy in front for TLS. Migrations applied, service enabled at boot, end-to-end verified (signup → JWT → authenticated reads → a PostGIS-backed `POST /locations`). Caddy serves `64-181-196-147.sslip.io` with a Let's Encrypt certificate issued 2026-09-20 (expires 2026-12-19, auto-renewed; renewal needs the VCN ingress rules for TCP 80/443 to stay). Runbook: `backend/docs/deploy-oracle.md`. Deploy path: `fly.toml` and the deploy workflow are untouched and still correct if the Fly route is ever taken (D37).
2. **Two real users for five days.** ⏭ (next; the deploy is ready, `FIELD_NOTES.md` is scaffolded, start date not yet set) Hadi plus one friend. Success is measured from `GET /messages`: ≤ budget nudges per day, at least one reply, a nightly line every night. Log what each of them says about a nudge that missed, verbatim, in a `FIELD_NOTES.md` — the quotes are the input to item 6.
3. **SMS end to end with a real number.** ⏸ (code path done in sprint 2; AWS registration is manual) Two-way SMS on AWS End User Messaging, the origination number registered, `POST /webhooks/sms` subscribed to the SNS topic, `JIKO_SMS_WEBHOOK_SECRET` set. The code path is written and tested against the SNS envelope; what is untested is the AWS side.
4. **Backups and a restore rehearsal.** ✅ (running nightly on the deployed box) `jiko-backup.timer` runs `scripts/backup.sh` at 03:30 UTC into `/opt/jiko/backups`, keeping 14. Rehearsed on the real host 2026-09-20: 18 tables, 4 migrations, no errors. Dumps are local only — `S3_BUCKET` is unset, so they survive a bad migration, not a lost instance. The restore has to run as the `postgres` superuser on this host; the reason and the exact commands are in the runbook (D38).

### B. Apple's paperwork
5. **FamilyControls entitlement.** ⏸ (the application is Apple's form to accept) Apply, and while waiting, build the iOS Screen Time path behind a flag: `DeviceActivityMonitor` reporting per-category minutes into `/sync/app-usage`. Ship it the day the entitlement lands; if it is refused, iOS stays location + health and the doomscroll rules stay a Mac feature.

### C. What the first week proves
6. **Cut the presets that misfire.** ⏸ (waiting on item 2's field notes) Whatever item 2's field notes show. The likely candidates: `late_night` (fires when you are deliberately up late), `morning_checkin` (says nothing useful when nothing is due), `deadline_drift` at low strictness. Deleting a preset is a valid outcome and cheaper than tuning it.
7. **A "that was wrong" button.** ✅ (done) One tap on a nudge records `metadata.feedback = 'wrong'` against its firing. Then: a weekly digest of wrong nudges per trigger, and a trigger that collects three of them in a week disables itself and says so. This is the smallest honest version of learning.
8. **Budget that adapts.** ✅ (done) Today the interrupt budget is a fixed number per day. Make it spend less on days the user has been replying "ok" (acknowledged but unchanged) and more on days with a real deadline. Bounded by the user's setting, never above it.

### D. The parts that are still stubs
9. **Location rules on iOS.** ✅ (done) The iOS agent posts fixes but the app has no UI for saving a place, so `preset:arrive` / `preset:leave` cannot be created from the phone. Add a "save this place" screen backed by `POST /locations`, and the two location presets in the iOS Rules tab.
10. **A Rules tab on iOS.** ✅ (done) Parity with the macOS Rules list: what is on, what it last fired for, enable/disable, and the preset list.
11. **Retire `SPRINT_PLAN.md`'s dead ends.** ✅ (done) `training/` still carries the subconversation clustering pipeline from the fine-tune idea that Sprint 2 scoped down to style extraction. Either delete it or move it under `training/experiments/` with a README saying what it was for.

### E. Hygiene
12. **`GET /messages` pagination.** ✅ (done) `limit` caps at 200 and there is no cursor. A month of use makes the conversation view slow and the LLM context expensive.
13. **Structured logs.** ✅ (done) `console.log` everywhere is fine on one machine and useless on three. One JSON line per request and per firing, with the user id, so a "why did nothing fire?" question can be answered from logs instead of a database query.
14. **The eval in CI, on a schedule.** ✅ (done) `npm run eval:voice` weekly against the deployed model, posting the pass rate. Not on every push: it costs real money and the failures are rarely caused by the diff.

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
