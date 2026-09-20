# Decisions log

Every non-obvious call made during the autonomous build, so each one can be overridden line by line. Newest at the bottom. Override by editing the code and appending a "Reversed:" note here.

## D1. Postgres is the only datastore for the MVP
DynamoDB held triggers, devices, preferences, messages, and chatbot tables; Postgres held users, activities, obligations, locations. The DynamoDB trigger code queried tables and columns that the setup script didn't create, used a binary-typed hash key for a boolean, and was untyped end to end. Consolidating on Postgres gave transactions, joins between triggers and the rows they reference (locations, activities, obligations), one container for integration tests, and JSONB for the free-form parts (match, condition, actions).
**Cost:** the README lists DynamoDB as part of the stack and it was part of the AWS learning goal. **To reverse:** the repository layer is the only place SQL lives; a DynamoDB implementation of `TriggerRepository` / `MessageRepository` can be swapped in behind the same interface. `@aws-sdk/client-sns` is still a dependency for the SMS channel.

## D2. Migrations are numbered SQL files, applied by a 60-line runner
`db/migrations/0001_baseline.sql` replaces the two `setupLocal*.ts` scripts. Pre-production, so one baseline instead of a history. `schema_migrations` records what ran. No down migrations; add a new numbered file to change anything.

## D3. One `obligations` table with a `kind` column, not a five-table hierarchy
The ER diagram had obligations -> deadlined_obligations -> events/tasks plus time_allocation_goals, and `docs/obligations.md` described a still larger hierarchy (AppointmentEvent, HomeworkTask, ObligationSchedule...). None of it had routes. The MVP needs "a title, a kind, and a time" so Jiko can say *why* it interrupted. Nullable kind-specific columns on one table cover task (`due_at`), event (`start_at`/`end_at`), goal (`target_minutes`/`timeframe_days`). Split later if a kind grows real structure.

## D4. Trigger = kind + match + condition + actions, stored as JSONB
Replaces `TRIGGERS` + `LOCATION_TRIGGERS` + `APP_USAGE_TRIGGERS` + `SCHEDULED_TRIGGERS` + `HEALTH_TRIGGERS`. `kind` says which sync event wakes it, `match` is the kind-specific filter (bundle ids, geofence + enter/exit, schedule), `condition` is the cross-cutting gate (time, obligations, usage, budget), `actions` is an ordered list. Every trigger fire is recorded in `trigger_firings` (drives cooldowns, quotas, dedupe, history).

## D5. The Action schema was cut from ~40 speculative actions to 11 executable ones
`types/json/Action.ts` had generated CRUD-style actions (`create_location_trigger`, `query_scheduled_actions`, `llm_summarize_activity`...) that nothing executed, and the executor switched on a different discriminator key than the schema used. Now the schema and the executor are the same list: `notify_user`, `start_activity`, `stop_activity`, `complete_obligation`, `create_obligation`, `set_preference`, `enable_trigger`, `disable_trigger`, `snooze_trigger`, `daily_summary`, `log`. Add an action by adding it to both files; the test suite will catch drift.

## D6. Unknown condition types evaluate to `false`
Previously `true`. A system whose purpose is not to spam people fails closed.

## D7. JWT payload is `{ user_id }` everywhere
Login signed `user_id`; signup and refresh signed `userId`; the middleware read one, `/auth/me` read the other. Standardised on `user_id`, all issuance and verification in `src/lib/jwt.ts`. Legacy `userId` tokens are rejected (there were no real users).

## D8. Interrupt budget and quiet hours live in the outbox, not in conditions
Conditions like `interrupt_budget_remaining` exist for triggers that want to check early, but `sendMessage()` is the enforcement point: nothing unsolicited leaves without passing the daily budget and quiet hours. Replies to the user (`counts_as_interrupt: false`) and `urgent` messages bypass. The budget derives from strictness when unset (`budgetForStrictness`).

## D9. Delivery channel default is `agent` (device pulls from `/messages/queued`)
No SMS/iMessage infra exists yet. The macOS agent polls for queued messages and shows them natively; that keeps the "shows up like a text" feel without Twilio. `console`, `webhook`, and `sms` (SNS) adapters exist behind the same interface; pick per user via `preferences.delivery_channel`.

## D10. Claude is optional and never on the critical path
`ANTHROPIC_API_KEY` unset = template text only. Set = nudges marked `voice: true` get rewritten in the user's chosen voice and free-form replies get answered, via `@anthropic-ai/sdk` with `claude-opus-5` at low effort. Any failure falls back to the template. Model is overridable with `JIKO_LLM_MODEL`. The `langchain` packages were removed (unused, unresolvable peer conflict).

## D11. In-memory sync caches stay
`AppUsageManager`, `HealthManager`, `LocationManager` keep the last hour of raw payloads per process. Conditions read those; the durable part is `app_usage_daily` (per-day, per-app rollup). Multi-process deployment would need Redis; not an MVP concern.

## D12. Relative imports end in `.js`
Node ESM needs the extension at runtime on compiled output. `AGENTS.md` previously said the opposite; updated.

## D13. Removed dead dependencies
`langchain`, `@langchain/*`, `jest`, `ts-jest`, `@types/jest`, `ts-node`, `tsconfig-paths`, `swagger-jsdoc`, `swagger-ui-express`, `openapi-markdown`, `openapi-typescript`, `ngeohash`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `dockerode` kept (localdb script). Added `@anthropic-ai/sdk`, `eslint`, `typescript-eslint`.

## D14. Apple working tree committed to `apple`; build artefacts and the prebuilt `.a` dropped
The stash of uncommitted Apple work (data models, queue, API client) is committed on `apple` (which now shares history with `backend`). `build/`, `build_static/`, `libs/libJikoSync.a`, `*.pbxproj.backup/.new`, `xcuserdata/`, `.DS_Store` are gitignored and untracked.

## D15. Location radius column renamed to `radius_m`
Makes the unit explicit and stops it colliding with the sync payload's `radius` (GPS accuracy).

## D16. Rate limits are per user when a token is present, per IP otherwise
`express-rate-limit` with four buckets: sync (120/min, devices are chatty), messages (60/min), auth (20 per 15 min, per IP), and a 300/min catch-all. The key is the JWT subject when the request carries a valid token, so one user on a shared NAT cannot rate-limit another. Limits are off under `NODE_ENV=test` and when `JIKO_RATE_LIMIT=off`; each bucket's size is overridable (`JIKO_RATE_LIMIT_SYNC` and friends). Body caps are split by path: 2 MB for `/sync/*` (batched logs), 128 KB everywhere else; oversize bodies get a 413 in the standard error shape.

## D17. Inbound SMS arrives as an SNS envelope on an unauthenticated webhook
`POST /webhooks/sms` accepts an SNS `SubscriptionConfirmation` (only auto-confirmed when `JIKO_SMS_AUTO_CONFIRM=true`, otherwise the URL is logged for a human), an SNS `Notification` wrapping AWS End User Messaging's `{originationNumber, messageBody}`, or a plain `{from, body}` post for local testing. The carrier has no bearer token, so the guards are a shared secret (`JIKO_SMS_WEBHOOK_SECRET`, in `?secret=` or `x-jiko-secret`) and the phone-number lookup: a number that matches no user is dropped with a 200. `inboundMessageId` is stored as `metadata.provider_id` and replayed deliveries are ignored.

## D18. `imessage` is a delivery channel the macOS agent fulfils, not a server-side sender
The backend treats `delivery_channel = imessage` exactly like `agent` (the message stays queued), and the agent decides what to do with it: `channel == "imessage"` goes to Messages.app over AppleScript addressed to the user's own number, anything else becomes a notification. A failed send (Automation permission denied, no iMessage account) falls back to a notification rather than dropping the nudge, and the reason surfaces in Settings. **Cost:** Apple-events entitlements and a temporary exception for `com.apple.MobileSMS`, which a sandboxed Mac App Store build would have to justify. **To reverse:** delete the `imessage` deliverer and the agent's `IMessageSender`; nothing else reads the channel.

## D19. Calendar subscriptions are stored URLs, re-imported by the scheduler
`calendar_subscriptions` holds one row per (user, URL) with a `window_days` horizon and a `refresh_hours` period; the scheduler sweep imports any row whose period elapsed, before it evaluates triggers, so a deadline pulled in this minute can fire a trigger this minute. Obligations are keyed `source = 'ics:<subscription id>'` plus the VEVENT UID, so a re-import updates in place. Deleting a subscription leaves its obligations behind: they were real. **Security:** this is the one place the server fetches a URL a user typed, so `normalizeIcsUrl` allows only https (webcal is rewritten) and refuses loopback / link-local / RFC1918 hosts unless `JIKO_ICS_ALLOW_PRIVATE=true`, with a size cap and a timeout on the fetch.

## D20. Goal progress is a condition, not a background job
`goal_progress` reads an open `kind = goal` obligation, sums `activity_entries` minutes for its `activity_id` over a rolling `timeframe_days` window, and compares that against `target_minutes` as a percentage. Nothing is precomputed: the numbers are a `SUM` over awindow-clipped range at evaluation time, which keeps the goal honest when entries are edited after the fact. `min_elapsed_fraction` stops a weekly goal from being nagged about on Monday morning. Goals with no `activity_id` or no `target_minutes` are skipped rather than counted as zero progress.

## D21. A reply to a tagged question is an answer, not a command
`notify_user` can carry `tag`, stored on the outbound message. When the next inbound message answers a message tagged `reflection`, talk-back stores it with `metadata.kind = 'reflection'` and acknowledges, instead of running "what worked this week?" through the snooze/done/stop parser (where "nothing worked, i stopped trying" would have disabled a trigger). `{{reflection}}` interpolates the most recent stored answer from the last nine days, and only queries for it when a template actually contains the variable.

## D22. The own-voice style guide is text, produced locally, and is the only thing that leaves the machine
`training/processing/style_guide.py` samples 200 of the user's own iMessage lines (sender `Me`, with codes, links and tapbacks filtered out) and writes a style guide: median length, capitalisation, punctuation habits, emoji use, the filler words they actually use. The default path is pure statistics and makes no network call at all; `--llm` optionally sends the samples to Claude from the user's own machine for a more natural write-up, and `--post` sends only the finished guide to the backend. It is stored in `user_preferences.voice_guide` (migration 0003) and replaces `VOICE_GUIDES.own_voice` in the rewrite prompt. No fine-tune, no message upload to Jiko's backend — the prompt is the product.

## D23. Sleep softens the tone through a voice hint, not through a condition
`voiceHints()` reads `sleep_minutes` over the last 24 hours and, under `JIKO_TIRED_SLEEP_MINUTES` (default 300), appends a line to the rewrite prompt telling Jiko to be gentler. It applies to every voiced nudge rather than being wired into one preset's condition, because the fact that the user slept four hours is true regardless of which trigger fired. Nudges that don't use the LLM are unaffected; the templates are already short.

## D24. The voice eval is ten canned situations x five voices, graded by a rubric with a deterministic floor
`npm run eval:voice` rewrites each case in each voice, then runs two layers of grading: mechanical checks that need no judge (every fact from the template survived, at most ~45 words and three sentences, no markdown, not empty), and an LLM judge answering a six-item rubric where four items are critical (length, no invented facts, no emoji or formatting, on the user's side). A case passes only if every mechanical check and every critical rubric item passes. The run writes the full report as JSON so two runs can be diffed, and exits 1 under `--min` (default 0.8). It is not in CI: it costs real API calls and is meant to be run either side of a prompt change.

## D25. Focus awareness is a leased quiet window reported by the device
macOS has no public API for "is a Focus on", and the file the system writes (`~/Library/DoNotDisturb/DB/Assertions.json`) is outside a sandboxed app's container — on macOS 15 that folder is often empty as well. So the agent asks for the folder once through an open panel, keeps a security-scoped bookmark, and reports what it finds; if the user never grants it, `FocusState` is `.unknown` and only the manual pause reports anything. The durable half is server-side: `PUT /users/quiet` sets `user_preferences.quiet_until`, and `sendMessage()` refuses with `quiet_mode` while that lease is live. It is a lease, renewed every sync and slightly longer than the sync interval, so a crashed agent cannot mute Jiko indefinitely — the failure mode is Jiko talking, not Jiko going silent. The manual pause now uses the same endpoint, so pausing on the Mac also quiets SMS.

## D26. One image, every instance runs the scheduler, a Postgres advisory lock picks the sweeper
The alternative — a separate worker process group with `ENABLE_SCHEDULER` set on exactly one machine — means a deploy can leave zero sweepers or two, and it is invisible until a nudge is missed or sent twice. Instead every instance ticks, and each tick opens a transaction that takes `pg_try_advisory_xact_lock`; the instance that loses simply returns. The lock lives as long as the sweep's transaction, and a crashed instance drops it when its connection dies, so leadership recovers without a heartbeat table. If the lock query itself fails, the sweep runs (single-instance behaviour) rather than the system going quiet.

## D27. `DATABASE_URL` wins over `PG*` and `RDS_*`
Fly, Neon and friends hand you a URL; the RDS IAM path is still there for the AWS deployment. The runtime and the migration runner both check `DATABASE_URL` first, and the migration runner skips `CREATE DATABASE` on that path because a managed database already exists and the role usually cannot create one. Deployment is `fly deploy`: the release command runs migrations, the image is a two-stage Node 22 Alpine build under `dumb-init` so SIGTERM reaches the shutdown handler, and `/health` is the health check. The GitHub Actions job typechecks and unit-tests before deploying, and no-ops when `FLY_API_TOKEN` is absent.

## D28. The firing stores its own explanation, rendered at fire time
`describeFiring()` turns a firing's matched context into one sentence, and the engine stores that sentence in the firing row alongside the raw context. Rendering later would mean re-deriving numbers that have since changed ("32 min on Instagram" is only true about that moment), and the raw context is kept anyway for anything that wants to dig. `GET /triggers?include=last_firing` gives the Rules list its "last time:" line and `GET /messages/:id/why` answers the question from a message. A message with no firing behind it — a reply, a summary, a self-send — gets an honest sentence rather than an invented one.

## D29. Both agents share one Swift package; the ObjC JikoSync library is gone
`apple/JikoKit` holds the API client, the Codable mirrors of the backend's JSON and the keychain wrapper — everything that has no platform in it. The iOS target previously linked a prebuilt `libJikoSync.a` through a bridging header; that library is gitignored, so the iOS project did not build for anyone who cloned the repo. It is deleted. Both apps now declare a local package reference (`XCLocalSwiftPackageReference` on `../JikoKit`) and the model/API tests live in the package's own suite instead of being duplicated per app. `Keychain.service` is the host bundle id, so the two agents keep separate tokens on the same machine.

## D30. The iOS agent ships location and health, and no screen time
`CLLocationManager` significant-change updates (a few hundred metres, background-capable, cheap) plus a client-side filter — 120 m or two minutes since the last send — keep the sync rate sane. HealthKit is read once an hour for two numbers: steps since local midnight and minutes actually asleep (time in bed is not sleep), posted to `/sync/health` as one flattened sample so `health_metric` conditions read `steps` and `sleep_minutes` directly. Screen Time needs the FamilyControls entitlement, which Apple has to approve; the app says so in Settings rather than pretending.

## D31. Parameters that feed `make_interval` are cast explicitly
`last_imported_at <= $1 - make_interval(hours => refresh_hours)` parses as `timestamptz <= interval` because Postgres cannot infer the type of a bare `$1` in that position, and the query fails at runtime rather than at typecheck. Caught by the calendar sweep logging an error during the integration run even though every test passed. Every such parameter now carries its cast (`$1::timestamptz`, `$3::int`), and the new integration suite exercises the sweep path so a repeat would fail a test rather than a log line.

## D32. A wrong nudge disables its rule after three strikes, and says so
`POST /messages/:id/feedback` stores `wrong` or `good` on the message. Three `wrong` verdicts against one trigger inside seven days turn it off, and Jiko sends a line saying which rule it turned off and why. The counting is a query over `messages.metadata`, not a new table: the verdict belongs to the message the user was looking at. This is deliberately not learning — no weights, no scoring, no silent tuning — because a rule that quietly changes behaviour is impossible to argue with, and being arguable is the point. `wrong_recently` appears next to each rule in both agents.

## D33. Logs are one JSON object per line, with the events worth grepping named
`src/lib/log.ts` emits JSON in production and readable text everywhere else, and the four events that answer real questions are named: `request`, `firing`, `held` (with the reason: quiet hours, quiet mode, budget) and `message_out`. "Why did nothing fire for me at 3pm?" is now `fly logs | jq 'select(.user_id == "…")'` instead of a database session. `LOG_LEVEL` defaults to `error` under test so the suites stay readable.

## D34. `GET /messages` pages backwards with a header cursor
A full page sets `X-Jiko-Next-Before` to the oldest message's timestamp; passing it back as `?before=` walks the conversation one page at a time. The response body stays a plain array, so the existing agents keep working without a change; only clients that want history need to read the header. A timestamp cursor (not an offset) means new messages arriving mid-scroll cannot shift the page boundary.

## D35. The interrupt budget is a ceiling Jiko can decide not to spend
`adaptBudget()` halves the day's budget when three quarters of the last three days' nudges went unanswered, takes one off when half the replies were a bare "ok", and restores the full number whenever something is due inside 24 hours. It never exceeds the user's setting and never drops below one, the decision is a pure function with its own tests, and `GET /messages/budget` reports both `budget` (today) and `budget_set` (the ceiling) plus the reason, so the user can see why Jiko went quieter instead of guessing. `JIKO_ADAPTIVE_BUDGET=off` turns it off.

## D36. Backups are a logical dump plus a rehearsed restore, not a cron job nobody has run
`scripts/backup.sh` writes a compressed custom-format `pg_dump`, then immediately runs `pg_restore --list` on it — a dump that cannot be listed is not a backup — prunes to the last fourteen, and uploads to S3 when `BACKUP_S3_BUCKET` is set. `scripts/restore.sh` restores into a target and then counts tables, users, messages, triggers and applied migrations, so "it restored" is a claim with numbers behind it. It refuses a target whose name does not look like a scratch database unless `RESTORE_I_MEAN_IT=yes`. Rehearsed against a live database before committing: 18 tables, the user, both messages and the trigger came back. The nightly workflow no-ops until `DATABASE_URL` is a real secret, so it does not fail every night before the deploy exists.
