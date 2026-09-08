// src/types/trigger/Trigger.ts
//
// A trigger = kind (which sync event wakes it) + match (kind-specific filter)
// + condition (cross-cutting gate) + actions. Mirrors the `triggers` table.
import { z } from "zod";
import crypto from "crypto";
import { ActionList } from "../json/Action.js";
import { Condition } from "../json/Condition.js";

export const TriggerKind = z.enum(["app_usage", "location", "scheduled", "health", "obligation"]);
export type TriggerKindT = z.infer<typeof TriggerKind>;

// --- match schemas, one per kind ------------------------------------------
export const AppUsageMatch = z.object({
  // Empty = any app. Use with condition app_usage_minutes { label: "distracting" } for "any distracting app".
  bundle_ids: z.array(z.string()).default([]),
  // Fire only once the app has accumulated this many foreground minutes in the window.
  min_minutes: z.number().min(0).default(0),
  window_minutes: z.number().int().positive().default(60),
}).strict();

export const LocationMatch = z.object({
  location_id: z.uuid(),
  event: z.enum(["enter", "exit", "both"]).default("both"),
}).strict();

export const ScheduledMatch = z.object({
  // First run. Subsequent runs computed from recurrence. ISO 8601.
  at: z.iso.datetime(),
  recurrence: z.object({
    interval: z.number().int().positive(),
    unit: z.enum(["minutes", "hours", "days", "weeks"]),
  }).optional(),
}).strict();

export const HealthMatch = z.object({
  metric: z.string(),
}).strict();

export const ObligationMatch = z.object({
  // Fire when an obligation of this kind is due within `hours_before`.
  kind: z.enum(["task", "event", "goal"]).optional(),
  hours_before: z.number().positive().default(24),
}).strict();

export const MatchByKind = {
  app_usage: AppUsageMatch,
  location: LocationMatch,
  scheduled: ScheduledMatch,
  health: HealthMatch,
  obligation: ObligationMatch,
} as const;

export type AppUsageMatchT = z.infer<typeof AppUsageMatch>;
export type LocationMatchT = z.infer<typeof LocationMatch>;
export type ScheduledMatchT = z.infer<typeof ScheduledMatch>;
export type HealthMatchT = z.infer<typeof HealthMatch>;
export type ObligationMatchT = z.infer<typeof ObligationMatch>;

// --- the row ---------------------------------------------------------------
const TriggerBase = z.object({
  id: z.uuid().default(() => crypto.randomUUID()),
  user_id: z.uuid(),
  name: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  condition: Condition.default(true),
  actions: ActionList,
  cooldown_seconds: z.number().int().min(0).default(0),
  next_run_at: z.coerce.date().nullable().optional(),
  last_fired_at: z.coerce.date().nullable().optional(),
  fire_count: z.number().int().min(0).default(0),
  source: z.string().default("user"),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export const Trigger = z.discriminatedUnion("kind", [
  TriggerBase.extend({ kind: z.literal("app_usage"), match: AppUsageMatch }),
  TriggerBase.extend({ kind: z.literal("location"), match: LocationMatch }),
  TriggerBase.extend({ kind: z.literal("scheduled"), match: ScheduledMatch }),
  TriggerBase.extend({ kind: z.literal("health"), match: HealthMatch }),
  TriggerBase.extend({ kind: z.literal("obligation"), match: ObligationMatch }),
]);
export type TriggerT = z.infer<typeof Trigger>;

// Client-facing create body: user_id comes from auth, id is generated.
export const TriggerCreate = z.discriminatedUnion("kind", [
  TriggerBase.omit({ user_id: true, id: true, fire_count: true, last_fired_at: true, created_at: true, updated_at: true, next_run_at: true })
    .extend({ kind: z.literal("app_usage"), match: AppUsageMatch }),
  TriggerBase.omit({ user_id: true, id: true, fire_count: true, last_fired_at: true, created_at: true, updated_at: true, next_run_at: true })
    .extend({ kind: z.literal("location"), match: LocationMatch }),
  TriggerBase.omit({ user_id: true, id: true, fire_count: true, last_fired_at: true, created_at: true, updated_at: true, next_run_at: true })
    .extend({ kind: z.literal("scheduled"), match: ScheduledMatch }),
  TriggerBase.omit({ user_id: true, id: true, fire_count: true, last_fired_at: true, created_at: true, updated_at: true, next_run_at: true })
    .extend({ kind: z.literal("health"), match: HealthMatch }),
  TriggerBase.omit({ user_id: true, id: true, fire_count: true, last_fired_at: true, created_at: true, updated_at: true, next_run_at: true })
    .extend({ kind: z.literal("obligation"), match: ObligationMatch }),
]);
export type TriggerCreateT = z.infer<typeof TriggerCreate>;

// PATCH body. `match` is validated against the stored kind by the route.
export const TriggerUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  match: z.record(z.string(), z.unknown()).optional(),
  condition: Condition.optional(),
  actions: ActionList.optional(),
  cooldown_seconds: z.number().int().min(0).optional(),
}).strict();
export type TriggerUpdateT = z.infer<typeof TriggerUpdate>;

export const TriggerFiring = z.object({
  id: z.uuid(),
  trigger_id: z.uuid(),
  user_id: z.uuid(),
  fired_at: z.coerce.date(),
  context: z.record(z.string(), z.unknown()),
  results: z.array(z.unknown()),
});
export type TriggerFiringT = z.infer<typeof TriggerFiring>;
