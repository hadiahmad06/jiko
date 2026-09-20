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
