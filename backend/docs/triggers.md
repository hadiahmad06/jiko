# Triggers

A trigger is the unit of "when X, do Y". This document is the contract for anyone writing one by hand, building a client UI for them, or extending the engine.

```jsonc
{
  "kind": "app_usage",                       // what wakes it: app_usage | location | scheduled | health | obligation
  "name": "Deadline drift",
  "enabled": true,
  "match": { "bundle_ids": [], "min_minutes": 0, "window_minutes": 60 },   // kind-specific filter
  "condition": {                             // cross-cutting gate, or `true`
    "type": "all", "params": { "conditions": [
      { "type": "app_usage_minutes", "params": { "label": "distracting", "window_minutes": 60, "operator": ">=", "minutes": 20 } },
      { "type": "obligation_due_within", "params": { "hours": 24 } },
      { "type": "outside_quiet_hours", "params": {} }
    ] }
  },
  "actions": [                               // ordered
    { "action": "notify_user", "params": { "message": "{{minutes}} min on {{app}} and {{obligation}} is due {{obligation_due}}. plan?", "voice": true, "urgent": true } }
  ],
  "cooldown_seconds": 2700
}
```

## Lifecycle

```
event arrives (sync, sweep, or manual test)
  └─ for each enabled trigger where trigger.kind == event.kind
       1. match      kind-specific; fills ctx.matched (app, location, obligation, metric) for templates
       2. cooldown   now - last_fired_at >= cooldown_seconds; a snooze pushes last_fired_at into the future
       3. condition  evaluateCondition(trigger.condition, ctx)
       4. execute    each action in order; results collected, never thrown
       5. record     trigger_firings row (context + results); scheduled kinds also get next_run_at
```

Everything the steps can look at is on the `TriggerContext` (`src/services/triggers/context.ts`): the event, the user's preferences, the last hour of app logs across devices, memoised lookups for obligations, geofences, open activity entries, health metrics, labels.

## Kinds and their `match`

| kind | wakes on | match fields | matched context |
|---|---|---|---|
| `app_usage` | `POST /sync/app-usage` | `bundle_ids` (empty = any app in the payload), `min_minutes` (foreground minutes in `window_minutes`) | `app { bundle_id, app_name, minutes }` (the heaviest candidate) |
| `location` | `POST /sync/location` | `location_id`, `event` = `enter` \| `exit` \| `both` | `location { id, name, event }` |
| `scheduled` | scheduler sweep | `at` (ISO), optional `recurrence { interval, unit }` | none |
| `health` | `POST /sync/health` | `metric` (must appear in a log) | `metric { name, value }` |
| `obligation` | scheduler sweep | `kind?`, `hours_before` | `obligation` (fires once per obligation, tracked in firings) |

A past `at` on a scheduled trigger is due immediately (one catch-up run). Recurrence computes strictly forward from `at`.

## Conditions

`true` is always allowed. Combinators nest: `all`, `any`, `none`, `at_least_n { n }`. Unknown types evaluate to **false**.

| type | params | true when |
|---|---|---|
| `time_range` | `start`, `end` (HH:MM), `timezone?` | local time in range; wraps midnight |
| `weekday` | `days` (name or list), `timezone?` | today is one of them |
| `outside_quiet_hours` | | local time outside `preferences.quiet_hours` |
| `app_usage_minutes` | `bundle_id?` or `label?` (else all), `window_minutes`, `operator`, `minutes` | foreground minutes in the window compare true; sessions are clipped to the window |
| `app_recently_used` | `bundle_id`, `within_seconds` | a session for that app ended within the window |
| `app_not_running` | `bundle_id`, `min_seconds_not_running` | no session ended within that many seconds |
| `no_foreground_activity` | `duration_minutes` | no foreground session ended within the window |
| `obligation_due_within` | `hours`, `kind?`, `min_intervention_level?` | an open obligation is due/starting within `hours` (sets `matched.obligation`) |
| `no_obligation_due_within` | `hours` | inverse |
| `activity_in_progress` | `activity_id?` | an entry with no `end_time` exists |
| `no_activity_in_progress` | | inverse |
| `inside_location` / `outside_location` | `location_id` | current point is / isn't inside the geofence (unknown position counts as outside) |
| `health_metric` | `metric`, `operator`, `value`, `window_hours` | latest sample in window compares true; no sample = false |
| `cooldown_expired` | `cooldown_seconds` | explicit cooldown independent of the trigger's own |
| `quota_remaining` | `max_daily` | this trigger fired fewer than N times today (user timezone) |
| `interrupt_budget_remaining` | | fewer unsolicited messages today than `preferences.interrupt_budget_per_day` |

Operators: `<`, `<=`, `>`, `>=`, `==`.

## Actions

| action | params | effect |
|---|---|---|
| `notify_user` | `message` (template), `urgent?`, `voice?` | `sendMessage()`; `urgent` bypasses budget and quiet hours; `voice` asks Claude to rewrite (if configured) |
| `start_activity` | `activity_id`, `note?` | opens an entry unless one is already open |
| `stop_activity` | `activity_id`, `note?` | closes the most recent open entry, `ended_by = trigger` |
| `complete_obligation` | `obligation_id` | marks complete |
| `create_obligation` | `title`, `kind?`, `due_in_minutes?` | creates one with `source = trigger` |
| `set_preference` | `key`, `value` | strictness, budget, voice, timezone, delivery_channel |
| `enable_trigger` / `disable_trigger` | `trigger_id` | |
| `snooze_trigger` | `trigger_id?` (default: self), `minutes` | pushes `last_fired_at` forward so cooldown covers the window |
| `daily_summary` | `days_ago?` | sends the one-line summary; never counts against the budget |
| `log` | `message` (template) | server log only; handy in tests |

Template variables: `{{name}}`, `{{app}}`, `{{minutes}}`, `{{location}}`, `{{obligation}}`, `{{obligation_due}}` ("in 6 hours"), `{{metric}}`, `{{metric_value}}`. Unknown variables render empty.

## Messages and budget

`sendMessage()` (`src/services/messaging/outbox.ts`) is the only door out. Unless `urgent` or `counts_as_interrupt: false`, it checks quiet hours then the daily budget, writes a `messages` row, and hands it to the deliverer for the user's `delivery_channel`:

- `agent` (default): stays `queued`; a device pulls `GET /messages/queued` and `POST /messages/ack`.
- `console`: printed, marked `sent`.
- `webhook`: POSTed to `JIKO_WEBHOOK_URL`.
- `sms`: AWS SNS to the user's phone number.

`GET /messages/budget` reports `{ used, budget, remaining, quiet_hours_active }`.

## Talk-back

`POST /messages { body, reply_to_id? }` stores the inbound message and runs `handleInbound`. Intents, in order of precedence:

| you say | intent | effect |
|---|---|---|
| `help` | help | lists the shortcuts |
| `stop`, `leave me alone`, `mute` | stop | disables the trigger behind the last nudge, or sets budget to 0 |
| `quiet`, `enough for today` | quiet | burns the rest of today's budget |
| `snooze 30`, `in 2 hours`, `not now` | snooze | pushes the last nudge's trigger forward N minutes (default 20) |
| `done`, `finished`, `done with the pset` | done | completes the matching (or soonest) open obligation |
| `status`, `summary`, `today` | status | today's one-liner + budget |
| `stricter` / `gentler` | | strictness ±0.2, budget adjusted |
| `ok`, `k`, `yeah` | ack | no reply |
| anything else | unknown | Claude answers if configured; otherwise a one-line acknowledgement |

Replies never count against the budget.

## Testing a trigger

`POST /triggers/:id/test` evaluates the trigger against the user's cached sync data right now. `{ "force": true }` skips match/cooldown/condition and just runs the actions (recorded as a forced firing). `GET /triggers/:id/firings` shows history with the matched context and each action's result.

## Adding a condition or action

1. Add the Zod schema to `src/types/json/Condition.ts` (in `Leaf`) or `Action.ts` (in the union).
2. Implement the case in `condition.ts` / `execute.ts`. TypeScript will refuse to compile until the switch is exhaustive enough.
3. Add a row to the tables above and a case to `src/tests/unit/services/condition.test.ts`.
