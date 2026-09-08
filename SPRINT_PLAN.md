# Jiko — Sprint 1 Plan

> **Status (2026-09-08, end of autonomous build): shipped.** Phases 0–6 are done, with one structural change from the plan: the MVP runs on Postgres only (DynamoDB dropped, see `DECISIONS.md` D1). Stretch items also shipped: obligations (one table, quick-add parser, ICS import), an interrupt budget with quiet hours, talk-back, a nightly summary, trigger presets, an onboarding flow, optional Claude voice, and a curl demo. Acceptance criteria 1–6 below are all met; criterion 5 was verified by launching the agent and by the model tests (real usage from a live Mac wasn't exercised end to end in this session). See `SPRINT_2.md` for what's next.

**Written:** 2026-09-08 · **Branch:** `backend` · **Owner:** Claude (executing), Hadi (deciding)

**Sprint goal:** one real end-to-end path works and is green in CI:

> device agent → `POST /auth/login` → `POST /sync/app-usage` → trigger evaluates → action executes → visible result

…plus the repo is in a state where a stranger (or a future me) can set it up from the README in under 15 minutes.

Everything below is ordered by dependency. Each item has a definition of done (DoD). Items marked **[decision]** have a question at the bottom; I proceed on the stated assumption unless told otherwise.

---

## 0. Where things actually stand (audit)

### Backend (`backend/`, Express 5 + TS + Zod 4 + Postgres/PostGIS + DynamoDB)

| Area | State | Evidence |
|---|---|---|
| Build | **Broken.** `tsc --noEmit` fails with 5 errors | `ActivityManager.ts` and `routes/activities.ts` import `ActivityQuery`, `PartialActivityWithIds`, `ActivityQueryT`, `PartialActivityEntryWithIdsT`, `PartialActivityWithIdsT` from `services/ActivityRepository.ts`, which only default-exports the repo instance. The schemas live in `types/activity/Activity.ts` / `ActivityEntry.ts`. |
| Unit tests | 51 pass / **4 fail** | The 4 failures (`PATCH /activities/entries`, `GET /activities/entries`, `PATCH /activities/:id`, `GET /activities/:id/entries`) are all `Cannot read properties of undefined (reading 'safeParse')` — same root cause as the build break. |
| Integration tests | **24 skipped** (3 files fail at collection) | They need Postgres on 5432 and DynamoDB Local on 8000 via Docker. Docker wasn't running. They also `TRUNCATE users CASCADE` on whatever DB is on 5432, i.e. the dev DB. |
| Auth | Works, but **JWT payload is inconsistent** | `login.ts` signs `{ user_id }`; `signup.ts` and `refresh.ts` sign `{ userId }`; `middleware/auth.ts` reads `payload.user_id`; `me.ts` reads `payload.userId`. Result: a token from signup can't call `/sync/*` or `/activities`, and a token from login can't call `/auth/me`. |
| Activities | Implemented on Postgres, tested via mocks | Only endpoint group with real persistence. |
| Sync (`/sync/app-usage`, `/sync/health`, `/sync/location`) | Implemented; in-memory per-process caches | `AppUsageManager`, `HealthManager`, `LocationManager` are singletons with a `Record<user_id, …>`. Fine for now; documented nowhere. |
| App-usage triggers | Implemented; queries DDB `APP_USAGE_TRIGGERS` GSI, evaluates `condition()` | `condition.ts` implements ~10 of ~20 condition types in `Condition.ts`; unimplemented types silently return `true`. |
| Location triggers | Implemented; PostGIS `ST_DWithin` + DDB `LOCATION_TRIGGERS` | Enter/exit/both. Has unit tests. |
| Scheduled triggers | **Never runs.** | `startTriggerScheduler()` is defined in `jobs/triggerScheduler.ts` but never called from `index.ts`. Service scans table `scheduled_triggers` (lowercase) while the setup script creates `SCHEDULED_TRIGGERS`. Uses the raw `getDdbClient()` with a `lib-dynamodb` `ScanCommand`. |
| Action execution (`execute.ts`) | Half-implemented, schema mismatch | Switches on `action.type` but `types/json/Action.ts` uses `action:` as the discriminator. `stop_activity` calls `updateEntry` with a fresh `randomUUID()` as the id, so it can never match a row. `notify_user` is a `console.log`. |
| `types/Trigger.ts` | **Empty file** | No Zod schema for trigger records; services use `any`. |
| Health triggers | Not started | `HEALTH_TRIGGERS` table exists in the setup script; `HealthManager` never calls a trigger service. |
| Triggers / Locations CRUD | **No API at all** | The only way to create a trigger or a location today is to write to DDB/Postgres by hand. This is the biggest functional hole: nothing can be exercised end-to-end without it. |
| Obligations (`/obligations/*`) | 13 endpoints, all `501` | Postgres tables exist (`obligations`, `deadlined_obligations`, `events`, `tasks`, `time_allocation_goals`). Zod schemas in `types/obligation/` don't match those tables (e.g. no `completed`, `archived`, `intervention_level`). |
| Users (`/users`, `/users/devices`, `/users/integrations`, `/users/preferences`) | 16 endpoints, all `501` | DDB tables exist. |
| OTP (`/auth/request-otp`, otp in signup/login) | Stubbed, SNS code commented out | |
| LLM | `langchain`, `@langchain/openai`, `@langchain/langgraph` installed; **zero imports** | `docs/langchain.md` and `docs/llm_calls.md` describe intent only. |
| OpenAPI | `src/openapi.ts` fully commented out; `generate:openapi` script would fail | |
| Docs | `AGENTS.md` (good, short), 6 files in `docs/` | `routes.md` is a diagram that drifts from code (`/debug/routes` vs `/debug-routes`); `obligations.md` describes a type hierarchy that doesn't exist in code; `architecture.md` is a self-described AI-generated AWS diagram. **No backend README, no `.env.example`.** |
| CI / lint | **None.** No `.github/`, no ESLint config in backend | |
| Secrets | `backend/.env` holds real AWS keys; it is **untracked** (backend `.gitignore` covers `.env*`) ✅ | Root `.gitignore` only has `*.DS_STORE` (wrong case); `.DS_Store` files are being tracked. |

### Apple (`apple/`)

| Area | State |
|---|---|
| `apple/JikoSync` (ObjC static lib) | Data models (`JikoAppUsageData`, `JikoLocationData`, `JikoHealthData`), in-memory `JikoDataQueue`, `JikoSyncAPI` with bearer auth + refresh-on-401, `JikoSyncManager` with 10s/30s timers. Built via hand-rolled `clang` shell scripts, not an Xcode target. |
| Known bugs | (1) `JikoSyncAPI` refresh sends `refresh_token` and reads `access_token`; backend expects `refreshToken` and returns `token`. (2) `processQueuedData` builds `itemsToRemove` inside async completion blocks but calls `removeItems:` synchronously before any completion fires, so successfully-synced items are never dequeued and get re-sent every 30 s. (3) Queue is not persisted; app restart loses data. (4) `JikoSyncEnvironment.snapshot` returns placeholder zeros. |
| `apple/JikoiOSAgent` | SwiftUI hello-world. `JikoSyncWrapper.m` and `JikoSyncManager.swift` are TODO stubs. A prebuilt `libs/libJikoSync.a` + headers are checked in as untracked files. |
| `apple/JikoMacOSAgent` | Menu-bar app; `AppSwitchObserver` logs frontmost-app changes. No duration accounting, no sync, no auth. |
| Tests | All three XCTest targets are the Xcode template placeholders. |
| Working tree | 7 modified + ~20 untracked apple files sitting uncommitted **on the `backend` branch**, including `build/`, `build_static/`, `project.pbxproj.backup`, `project.pbxproj.new`, `TestImport.m`. |
| Branches | `dev` and `apple` each contain one commit (`95cd7a8`, "made some changes that i dont remember") not on `backend`; it deletes the stale duplicate `JikoSync/` at repo root and touches the macOS pbxproj. `backend` is 7 ahead of `main`. `web` == `backend`. `training` is 25 behind. |

### Web (`web/`) — Next 15 landing page. Builds, looks done for its purpose. **Out of scope this sprint.**

### Training (`training/`) — iMessage HTML → JSON → time-gap clustering. Raw exports (806 files, 28 MB, personal messages) are gitignored. **Out of scope this sprint.**

---

## 1. Sprint backlog

Estimated at roughly two weeks of focused sessions. "Day" = one working session, not a calendar day.

### Phase 0 — Repo hygiene (Day 1) 

**0.1 Untangle the working tree.** [decision Q2, Q3]
- Commit the Apple WIP on a branch named `apple` (not `backend`): the ObjC source changes and the two build scripts. Do **not** commit `build/`, `build_static/`, `libs/libJikoSync.a`, `*.pbxproj.backup`, `*.pbxproj.new`, `TestImport.m`.
- Add to root `.gitignore`: `.DS_Store`, `apple/**/build/`, `apple/**/build_static/`, `*.pbxproj.backup`, `*.pbxproj.new`, `xcuserdata/`. Untrack the `.DS_Store` files already committed.
- Merge `95cd7a8` (from `dev`/`apple`) into `backend` so the root-level duplicate `JikoSync/` goes away and there's one lineage.
- DoD: `git status` clean on both branches; `git log --graph` shows `apple` and `backend` sharing `95cd7a8`.

**0.2 Add `backend/.env.example`** with every variable the code reads (`PORT`, `IS_OFFLINE`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `RDS_HOST`, `RDS_PORT`, `RDS_USER`, `RDS_DB_NAME`, `APP_VERSION`) with placeholder values and a one-line comment each.

### Phase 1 — Make the backend build and unit tests green (Days 1–2)

**1.1 Fix the type imports.** Point `ActivityManager.ts` and `routes/activities.ts` at `types/activity/Activity.ts` and `ActivityEntry.ts`. Also fix `routes/activities.ts` `PATCH /activities/entries`, which parses with `PartialActivityWithIds` (activity schema) instead of `PartialActivityEntryWithIds`.
- DoD: `npx tsc --noEmit` exits 0; `npm test` shows 0 failed unit tests.

**1.2 Unify the JWT contract.** One payload shape, `{ user_id }`, signed in `signup`, `login`, `refresh`; verified only in `middleware/auth.ts`. Make `/auth/me` use the middleware instead of re-implementing verification. Keep response keys stable (`token`, `refreshToken`).
- Add unit tests: signup token → `/auth/me` 200; login token → `/sync/app-usage` 200; refresh token → new token works on a protected route.

**1.3 Add `npm run typecheck`** (`tsc --noEmit`) and make `npm test` run it first (`pretest`).

**1.4 Add ESLint** (flat config, `typescript-eslint` recommended, no style rules) and `npm run lint`. Zero warnings policy on `src/`, not on `dist/`.

**1.5 GitHub Actions** `.github/workflows/backend.yml`: on push/PR touching `backend/**`: `npm ci`, `lint`, `typecheck`, unit tests. Integration job with service containers `postgis/postgis:15-3.3` and `amazon/dynamodb-local`, running the setup scripts' `createTables()` (needs refactor, see 2.1) then `npm run test:integration`.
- DoD: green check on the `backend` branch.

### Phase 2 — Make integration tests runnable and honest (Days 3–4)

**2.1 Split DB provisioning from Docker lifecycle.** Refactor `scripts/setupLocalPostgreSQL.ts` and `setupLocalDynamoDB.ts` so `createTables()` is importable and idempotent (the Postgres one currently does `CREATE TYPE log_type` unguarded, which fails on second run). Keep `npm run localdb` as the Docker wrapper.

**2.2 Separate test database.** Integration tests connect to `jiko_test` (env `PGDATABASE` override in `psqlClient.ts`) so `TRUNCATE users CASCADE` never touches dev data. Add `npm run test:unit` and `npm run test:integration` (vitest `--project` or include globs); `npm test` = unit only, so a missing Docker doesn't produce 3 red files.

**2.3 Integration coverage for the sprint path.** One test that does: signup → login → create location → create location trigger → `POST /sync/location` outside → inside → assert trigger fired and `start_activity` created an `activity_entries` row. Same shape for app-usage.

### Phase 3 — Fix the trigger engine (Days 4–6)

**3.1 Define trigger schemas in `types/Trigger.ts`.** Zod objects for `TRIGGERS`, `LOCATION_TRIGGERS`, `APP_USAGE_TRIGGERS`, `SCHEDULED_TRIGGERS`, `HEALTH_TRIGGERS` matching the DDB setup script and `docs/erdiagram.md`. Reconcile the `enabled_event_type` vs `enabled_bundle_id` naming (code uses the former, ER diagram the latter) — pick one and update both.

**3.2 Fix `execute.ts`.** Parse incoming actions with the `Action` union from `types/json/Action.ts` (discriminator `action`, not `type`). Fix `stop_activity` to find the user's open entry for `activity_id` (`end_time IS NULL`) and close it. Return a `Result` instead of a bare string so closures (`success`/`failure` branches) are driven by real outcomes. Unit tests for `start_activity`, `stop_activity`, closure branching, and invalid action rejection.

**3.3 Scheduled triggers.** Fix the table name and client, call `startTriggerScheduler()` from `index.ts` behind `ENABLE_SCHEDULER=true`, replace the `Scan` with the GSI the setup script already creates (`enabled`/`scheduled_at`), and make the 10 s interval configurable. Unit test `rescheduleTrigger` for each unit.

**3.4 `condition.ts` completeness.** Either implement or explicitly reject (return `false` + warn) every type in `Condition.ts`. Silent `true` for unknown conditions is the wrong default for a system whose job is to *not* spam people. Add `cooldown_expired` and `quota_remaining` since they're the anti-spam primitives (in-memory store is fine for now). Table-driven unit tests.

### Phase 4 — Fill the stubs that block the end-to-end path (Days 6–9)

**4.1 Locations CRUD** — `GET/POST/PATCH/DELETE /locations`, Postgres `locations` table (already has PostGIS trigger). `LocationRepository` + tests.

**4.2 Triggers CRUD** — `GET /triggers`, `POST /triggers/{location|app-usage|scheduled}`, `PATCH /triggers/:id` (enable/disable + edit), `DELETE /triggers/:id`. Writes the base `TRIGGERS` record plus the subtype record. Validated with 3.1 schemas. `TriggerRepository` + tests. This is what makes 2.3 possible without hand-writing DDB items.

**4.3 Devices + Preferences** — `/users/devices` (register/list/delete, DDB `DEVICES`) and `/users/preferences` (get/patch, DDB `USER_PREFERENCES`). Small, unblocks the Apple agent registering itself. `/users/integrations` and `DELETE /users` stay 501 this sprint.

**4.4 `notify_user` does something.** [decision Q5] Minimum: persist to DDB `MESSAGES` (`is_user=false`) and expose `GET /messages?since=`. Stretch: SNS SMS behind `NOTIFY_CHANNEL=sns`.

**4.5 Health triggers** (stretch) — mirror `appUsageTriggerService` for `HEALTH_TRIGGERS`; call from `HealthManager.updateHealth`.

### Phase 5 — Documentation (runs alongside 1–4; finalized Day 9–10)

**5.1 `backend/README.md`**: prerequisites, `npm run localdb`, `.env.example`, `npm run dev`, test commands, project layout (`routes → data (managers/caches) → services (repositories, triggers) → db`), the `Result<T>` convention, table-to-store map (which entities live in Postgres vs DDB and why).

**5.2 `backend/docs/triggers.md`**: how a sync request becomes an action — data flow, record shapes, condition types with examples, action types with examples, the closure mechanism, cooldown semantics. Replace the prose currently living in comment blocks at the bottom of the service files.

**5.3 Regenerate `docs/routes.md`** from the actual router stack (the `printRoutes` helper in `app.ts` already walks it) with a status column: implemented / 501 / planned. Delete or clearly label `architecture.md` and `obligations.md` as aspirational.

**5.4 Uncomment and wire `src/openapi.ts`** only if cheap (< 1 session); otherwise delete the dead `generate:openapi` script so `package.json` doesn't lie.

**5.5 Update `AGENTS.md`** with the new scripts (`typecheck`, `lint`, `test:unit`, `test:integration`) and the JWT/`Result` conventions.

### Phase 6 — Apple agent talks to the backend (Days 10–12) [decision Q1]

**6.1 Fix `JikoSyncAPI` contract**: send `refreshToken`, read `token`; add `loginWithPhone:password:` that stores both tokens in Keychain.

**6.2 Fix the dequeue race** in `JikoSyncManager.processQueuedData`: remove items inside the completion handler, or use a dispatch group. Persist `JikoDataQueue` to a plist/JSON file in Application Support so restarts don't lose data.

**6.3 Replace the clang scripts with an Xcode static-library target** (or a local SwiftPM package with an ObjC target) that both agents depend on. Remove the checked-in `.a`.

**6.4 macOS agent minimal loop**: `AppSwitchObserver` accumulates foreground durations per bundle id → builds `JikoAppUsageLog` → enqueues → `POST /sync/app-usage` every 30 s. Settings sheet with base URL + phone/password. Display last sync status in the menu.

**6.5 XCTest for `JikoSync`**: `toDictionary` shape matches backend Zod schemas (snapshot the JSON and validate it against the same fixtures the backend unit tests use); queue persistence round-trip; dequeue-on-success.

iOS stays hello-world this sprint; Screen Time on iOS needs `FamilyControls`/`DeviceActivity` entitlements and an App Group extension, which is its own sprint.

### Explicitly deferred (next sprint candidates)
- Obligations API (tables and docs exist, schemas need reconciling first).
- OTP via SNS.
- Any LLM/LangChain usage (deps stay installed; no code until an action needs it).
- Redis or any cross-process cache; in-memory managers are fine until there's more than one server process.
- `/users/integrations`, chatbots, speaking styles.
- iOS Screen Time.
- Web and training directories.

---

## 2. Sprint acceptance criteria

1. `cd backend && npm ci && npm run lint && npm run typecheck && npm test` is green with no Docker.
2. `npm run localdb && npm run test:integration` is green locally and in GitHub Actions.
3. A fresh clone + README gets a dev server running against local Docker DBs.
4. Using only HTTP (curl or the macOS agent): signup, create a location, create a location trigger with a `start_activity` action, post two location updates, and observe a new `activity_entries` row.
5. The macOS agent posts real app-usage data to a local backend and an app-usage trigger fires on it.
6. Every 501 route is listed as such in `docs/routes.md`.

---

## 3. Risks

- **Two datastores** (Postgres + DDB) double the integration-test surface and the setup cost. Keeping it this sprint; see Q6.
- **Trigger table naming** is inconsistent across code, setup script, and ER diagram; 3.1 will surface more of these.
- **Xcode project surgery** (6.3) is the least predictable item; if it eats more than a session, fall back to keeping the clang script but gitignoring its output.
- **Zod 4** APIs (`z.uuid()`, `z.json()`, `z.float64()`) are used inconsistently with Zod 3 style elsewhere; expect small type errors when tightening.

---

## 4. Open questions (answer whenever; I proceed on the bold assumption)

1. **First end-to-end device:** macOS or iOS? **Assuming macOS** — no entitlement friction, `AppSwitchObserver` already exists.
2. **Branching:** Should the sprint land on `backend` and merge to `main` at the end, or should I work on `main` directly now that `backend` is the de facto trunk? **Assuming: work on `backend`, PR to `main` at sprint end.** Apple work goes on `apple`.
3. **Apple WIP:** OK to commit the untracked ObjC sources and scripts to `apple`, and to drop the checked-in `libJikoSync.a`, `build/`, `build_static/`, and the `.pbxproj.backup/.new` files? **Assuming yes** (sources are reproducible from the scripts).
4. **Obligations:** deferred entirely this sprint. Object if that's the feature you actually care about most.
5. **Notification channel:** the web copy promises iMessage, `thoughtboard.md` mentions Discord/WhatsApp/Twilio, the code has commented-out SNS. What should `notify_user` do first? **Assuming: persist to `MESSAGES` + a `GET /messages` endpoint; delivery channel next sprint.**
6. **DynamoDB for triggers:** keep, or move triggers/devices/preferences into Postgres so there's one database and one integration-test container? **Assuming keep** this sprint; flagging because it would simplify a lot.
7. **Sprint length:** I sized this at ~12 working sessions. Tell me if you want it cut to one week (I'd stop after Phase 4.2 and 5.1–5.3).
8. **Condition default:** unknown condition types currently evaluate to `true`. I plan to flip that to `false`. Confirm.
