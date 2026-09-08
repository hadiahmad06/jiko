# Jiko backend

The server side of Jiko: ingests app-usage / location / health syncs from devices, runs the trigger engine, and holds the conversation between Jiko and the user.

Express 5 · TypeScript · Zod 4 · Postgres 15 + PostGIS · Vitest. Optional: Claude (voice), AWS SNS (SMS).

## Run it locally

Prerequisites: Node 22+, Docker.

```bash
cd backend
npm ci
cp .env.example .env        # set JWT_SECRET / JWT_REFRESH_SECRET
npm run localdb             # starts postgis in Docker, creates jiko + jiko_test, migrates both
npm run dev                 # http://localhost:3000
```

Smoke test:

```bash
curl -s localhost:3000/health
curl -s -X POST localhost:3000/auth/signup -H 'content-type: application/json' \
  -d '{"phone_number":"+15550001111","password":"Password123!","nickname":"hadi"}'
```

Tests:

```bash
npm test                    # typecheck + unit tests, no DB needed
npm run test:integration    # needs jiko_test (npm run localdb)
npm run lint
```

## How a nudge happens

```
device ──POST /sync/app-usage──▶ AppUsageManager ──▶ runTriggers(user, event)
                                      │                       │
                                      ├─ merge last hour      ├─ for each enabled trigger of that kind:
                                      │   into memory         │     match?  (bundle ids, minutes in window)
                                      └─ roll up per-day      │     cooldown expired?
                                          totals in Postgres  │     condition true?  (time, obligations, budget…)
                                                              │     execute actions ──▶ sendMessage()
                                                              │                              │
                                                              └─ record trigger_firings      ├─ quiet hours?
                                                                                             ├─ budget left?
                                                                                             └─ messages row + deliverer
device ◀──GET /messages/queued─────────────────────────────────────────────────────────────────┘
device ──POST /messages {"body":"snooze 30"}──▶ talk-back ──▶ trigger snoozed, reply queued
```

Read [docs/triggers.md](docs/triggers.md) for the full model, [docs/data-model.md](docs/data-model.md) for tables, [docs/routes.md](docs/routes.md) for every endpoint.

## Layout

| Path | What lives there |
|---|---|
| `src/routes/` | Express routers, auto-mounted. Validate, call, respond. No logic. |
| `src/data/` | Per-user in-memory caches of the last hour of sync data; they kick the engine. |
| `src/services/repositories/` | One module per table. All SQL. |
| `src/services/triggers/` | Engine, conditions, actions, scheduler sweep, presets, schedule math. |
| `src/services/messaging/` | Outbox (budget + quiet hours), delivery adapters, talk-back, Claude voice. |
| `src/services/summary.ts` | The one-line daily summary. |
| `src/services/quickadd.ts` | "OS midterm thu 2pm" → obligation. |
| `src/types/` | Zod schemas; types are inferred from them. |
| `src/lib/` | JWT, HTTP helpers. |
| `db/migrations/` | Numbered SQL, applied by `src/db/migrate.ts`. |
| `scripts/` | `localdb`, `migrate`, `printRoutes`. |

## Concepts in one paragraph each

**Sync.** Devices post `AppUsageData` (a list of foreground sessions), `LocationData` (a point), or `HealthData` (metric logs). Each post is merged into an in-memory window per user/device, rolled into `app_usage_daily`, and handed to the engine as an event.

**Trigger.** `kind` (which event wakes it) + `match` (kind-specific filter) + `condition` (JSON gate) + `actions` (ordered list) + `cooldown_seconds`. Presets at `GET /triggers/presets` build the common ones (`doomscroll`, `deadline_drift`, `late_night`, `arrive`, `leave`, `nightly_summary`, `deadline_reminder`, `morning_checkin`).

**Obligation.** Why Jiko is allowed to interrupt. A task with `due_at`, an event with `start_at`, or a goal with a minutes target. `POST /obligations/quick` parses natural text.

**Messages.** Every nudge is a row. Outbound rows are `queued` until a device acks them (or a channel delivers). The user replies via `POST /messages`; the talk-back parser turns "snooze 30", "done", "stop", "status", "stricter" into effects and a reply.

**Budget.** `preferences.interrupt_budget_per_day` and `quiet_hours` gate every unsolicited message in `sendMessage()`. Replies and `urgent` nudges bypass. Strictness sets the default budget.

**Voice.** If `ANTHROPIC_API_KEY` is set, nudges with `voice: true` are rewritten in the user's chosen voice and free-form replies get a real answer. Otherwise templates.

## Environment

See [.env.example](.env.example). `IS_OFFLINE=true` uses local Postgres via `PG*`; `false` uses RDS with IAM auth via `RDS_*`.

## Deploying

Not wired yet. `npm run build && npm start` produces a plain Node process; it needs Postgres reachable, the JWT secrets, and `ENABLE_SCHEDULER=true` on exactly one instance.
