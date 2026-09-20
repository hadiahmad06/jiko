// src/types/json/Condition.ts
//
// Conditions gate a trigger after its kind-specific matcher passes. `true` is
// the identity condition. Every type listed here is implemented in
// services/triggers/condition.ts; unknown types evaluate to false.
import { z } from "zod";

const HHMM = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM");
const Weekday = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const Cmp = z.enum(["<", "<=", ">", ">=", "=="]);

// --- time ------------------------------------------------------------------
export const TimeRangeCondition = z.object({
  type: z.literal("time_range"),
  params: z.object({
    start: HHMM,
    end: HHMM,
    // Falls back to the user's preference timezone.
    timezone: z.string().optional(),
  }),
});

export const WeekdayCondition = z.object({
  type: z.literal("weekday"),
  params: z.object({
    days: z.union([Weekday, z.array(Weekday).min(1)]),
    timezone: z.string().optional(),
  }),
});

export const QuietHoursCondition = z.object({
  type: z.literal("outside_quiet_hours"),
  params: z.object({}).default({}),
});

// --- app usage -------------------------------------------------------------
export const AppUsageMinutesCondition = z.object({
  type: z.literal("app_usage_minutes"),
  params: z.object({
    bundle_id: z.string().optional(),      // omit = any distracting app (per app_labels)
    label: z.enum(["distracting", "work", "neutral"]).optional(),
    window_minutes: z.number().int().positive().default(60),
    operator: Cmp.default(">="),
    minutes: z.number().min(0),
  }),
});

export const AppRecentlyUsedCondition = z.object({
  type: z.literal("app_recently_used"),
  params: z.object({
    bundle_id: z.string(),
    within_seconds: z.number().int().positive(),
    device_id: z.string().optional(),
  }),
});

export const AppNotRunningCondition = z.object({
  type: z.literal("app_not_running"),
  params: z.object({
    bundle_id: z.string(),
    min_seconds_not_running: z.number().int().min(0).default(30),
  }),
});

export const NoForegroundActivityCondition = z.object({
  type: z.literal("no_foreground_activity"),
  params: z.object({
    duration_minutes: z.number().int().min(1),
    device_id: z.string().optional(),
  }),
});

// --- obligations -----------------------------------------------------------
export const ObligationDueWithinCondition = z.object({
  type: z.literal("obligation_due_within"),
  params: z.object({
    hours: z.number().positive(),
    kind: z.enum(["task", "event", "goal"]).optional(),
    min_intervention_level: z.number().min(0).max(1).optional(),
  }),
});

export const NoObligationDueWithinCondition = z.object({
  type: z.literal("no_obligation_due_within"),
  params: z.object({ hours: z.number().positive() }),
});

// --- goals -----------------------------------------------------------------
// Progress against a `kind = goal` obligation: minutes logged for its activity
// in the last `timeframe_days` as a percentage of `target_minutes`.
export const GoalProgressCondition = z.object({
  type: z.literal("goal_progress"),
  params: z.object({
    goal_id: z.uuid().optional(),        // a specific goal
    activity_id: z.uuid().optional(),    // or every goal tracking this activity
    operator: Cmp.default("<"),
    // Percent of the target, 0-100. `{operator: "<", percent: 60}` = behind.
    percent: z.number().min(0).max(1000).default(60),
    // Overrides the goal's own timeframe when set.
    timeframe_days: z.number().positive().optional(),
    // Only fire once the window is far enough along to be fair (0-1 of elapsed
    // timeframe). 0.5 = "don't nag on monday about a weekly goal".
    min_elapsed_fraction: z.number().min(0).max(1).default(0),
  }),
});

// --- activities ------------------------------------------------------------
export const ActivityInProgressCondition = z.object({
  type: z.literal("activity_in_progress"),
  params: z.object({ activity_id: z.uuid().optional() }),
});

export const NoActivityInProgressCondition = z.object({
  type: z.literal("no_activity_in_progress"),
  params: z.object({}).default({}),
});

// --- location --------------------------------------------------------------
export const InsideLocationCondition = z.object({
  type: z.literal("inside_location"),
  params: z.object({ location_id: z.uuid() }),
});

export const OutsideLocationCondition = z.object({
  type: z.literal("outside_location"),
  params: z.object({ location_id: z.uuid() }),
});

// --- health ----------------------------------------------------------------
export const HealthMetricCondition = z.object({
  type: z.literal("health_metric"),
  params: z.object({
    metric: z.string(),      // e.g. "steps", "sleep_minutes", "heart_rate"
    operator: Cmp,
    value: z.number(),
    window_hours: z.number().positive().default(24),
  }),
});

// --- rate limiting ---------------------------------------------------------
export const CooldownExpiredCondition = z.object({
  type: z.literal("cooldown_expired"),
  params: z.object({ cooldown_seconds: z.number().int().min(0) }),
});

export const QuotaRemainingCondition = z.object({
  type: z.literal("quota_remaining"),
  params: z.object({ max_daily: z.number().int().min(0) }),
});

export const InterruptBudgetRemainingCondition = z.object({
  type: z.literal("interrupt_budget_remaining"),
  params: z.object({}).default({}),
});

// --- combinators -----------------------------------------------------------
// Recursive: combinators contain conditions.
export type ConditionT =
  | boolean
  | z.infer<typeof TimeRangeCondition>
  | z.infer<typeof WeekdayCondition>
  | z.infer<typeof QuietHoursCondition>
  | z.infer<typeof AppUsageMinutesCondition>
  | z.infer<typeof AppRecentlyUsedCondition>
  | z.infer<typeof AppNotRunningCondition>
  | z.infer<typeof NoForegroundActivityCondition>
  | z.infer<typeof ObligationDueWithinCondition>
  | z.infer<typeof NoObligationDueWithinCondition>
  | z.infer<typeof GoalProgressCondition>
  | z.infer<typeof ActivityInProgressCondition>
  | z.infer<typeof NoActivityInProgressCondition>
  | z.infer<typeof InsideLocationCondition>
  | z.infer<typeof OutsideLocationCondition>
  | z.infer<typeof HealthMetricCondition>
  | z.infer<typeof CooldownExpiredCondition>
  | z.infer<typeof QuotaRemainingCondition>
  | z.infer<typeof InterruptBudgetRemainingCondition>
  | { type: "all"; params: { conditions: ConditionT[] } }
  | { type: "any"; params: { conditions: ConditionT[] } }
  | { type: "none"; params: { conditions: ConditionT[] } }
  | { type: "at_least_n"; params: { n: number; conditions: ConditionT[] } };

const Leaf = z.discriminatedUnion("type", [
  TimeRangeCondition,
  WeekdayCondition,
  QuietHoursCondition,
  AppUsageMinutesCondition,
  AppRecentlyUsedCondition,
  AppNotRunningCondition,
  NoForegroundActivityCondition,
  ObligationDueWithinCondition,
  NoObligationDueWithinCondition,
  GoalProgressCondition,
  ActivityInProgressCondition,
  NoActivityInProgressCondition,
  InsideLocationCondition,
  OutsideLocationCondition,
  HealthMetricCondition,
  CooldownExpiredCondition,
  QuotaRemainingCondition,
  InterruptBudgetRemainingCondition,
]);

export const Condition: z.ZodType<ConditionT> = z.lazy(() =>
  z.union([
    z.boolean(),
    Leaf,
    z.object({ type: z.literal("all"), params: z.object({ conditions: z.array(Condition) }) }),
    z.object({ type: z.literal("any"), params: z.object({ conditions: z.array(Condition) }) }),
    z.object({ type: z.literal("none"), params: z.object({ conditions: z.array(Condition) }) }),
    z.object({ type: z.literal("at_least_n"), params: z.object({ n: z.number().int().min(0), conditions: z.array(Condition) }) }),
  ])
);

export const CONDITION_TYPES = [
  ...Leaf.options.map(o => o.shape.type.value),
  "all", "any", "none", "at_least_n",
] as const;
