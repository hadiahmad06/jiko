// src/types/json/Action.ts
//
// Actions a trigger can execute. Discriminated on `action`. Every action is
// executable today by services/triggers/execute.ts; speculative actions were
// removed so the schema and the executor can't drift.
import { z } from "zod";

export const NotifyUserAction = z.object({
  action: z.literal("notify_user"),
  params: z.object({
    // Template. Supports {{app}}, {{minutes}}, {{obligation}}, {{obligation_due}}, {{location}}, {{name}}.
    message: z.string().min(1).max(1000),
    // Optional alternates. The trigger's fire_count picks one, so an ignored nudge
    // never repeats itself verbatim: [message, ...messages][fire_count % n].
    messages: z.array(z.string().min(1).max(1000)).max(10).optional(),
    // If true, bypasses the daily interrupt budget (use sparingly: deadlines).
    urgent: z.boolean().optional(),
    // Optional: rewrite the message in the user's chosen voice via the LLM (if configured).
    voice: z.boolean().optional(),
  }),
});

export const StartActivityAction = z.object({
  action: z.literal("start_activity"),
  params: z.object({
    activity_id: z.uuid(),
    note: z.string().optional(),
  }),
});

export const StopActivityAction = z.object({
  action: z.literal("stop_activity"),
  params: z.object({
    activity_id: z.uuid(),
    note: z.string().optional(),
  }),
});

export const CompleteObligationAction = z.object({
  action: z.literal("complete_obligation"),
  params: z.object({ obligation_id: z.uuid() }),
});

export const CreateObligationAction = z.object({
  action: z.literal("create_obligation"),
  params: z.object({
    title: z.string().min(1),
    kind: z.enum(["task", "event", "goal"]).default("task"),
    due_in_minutes: z.number().int().positive().optional(),
  }),
});

export const SetPreferenceAction = z.object({
  action: z.literal("set_preference"),
  params: z.object({
    key: z.enum(["strictness", "interrupt_budget_per_day", "voice", "timezone", "delivery_channel"]),
    value: z.union([z.string(), z.number()]),
  }),
});

export const EnableTriggerAction = z.object({
  action: z.literal("enable_trigger"),
  params: z.object({ trigger_id: z.uuid() }),
});

export const DisableTriggerAction = z.object({
  action: z.literal("disable_trigger"),
  params: z.object({ trigger_id: z.uuid() }),
});

export const SnoozeTriggerAction = z.object({
  action: z.literal("snooze_trigger"),
  params: z.object({
    // Defaults to the trigger being executed.
    trigger_id: z.uuid().optional(),
    minutes: z.number().int().positive(),
  }),
});

export const DailySummaryAction = z.object({
  action: z.literal("daily_summary"),
  params: z.object({
    // Which day, relative to the user's timezone. 0 = today, 1 = yesterday.
    days_ago: z.number().int().min(0).max(7).default(0),
  }).default({ days_ago: 0 }),
});

export const LogAction = z.object({
  action: z.literal("log"),
  params: z.object({ message: z.string() }),
});

export const Action = z.discriminatedUnion("action", [
  NotifyUserAction,
  StartActivityAction,
  StopActivityAction,
  CompleteObligationAction,
  CreateObligationAction,
  SetPreferenceAction,
  EnableTriggerAction,
  DisableTriggerAction,
  SnoozeTriggerAction,
  DailySummaryAction,
  LogAction,
]);

export type ActionT = z.infer<typeof Action>;
export type ActionName = ActionT["action"];

export const ActionList = z.array(Action).min(1).max(20);
export type ActionListT = z.infer<typeof ActionList>;

export const ActionResult = z.object({
  action: z.string(),
  ok: z.boolean(),
  detail: z.string().optional(),
  // e.g. the created message id or activity entry id
  ref: z.string().optional(),
});
export type ActionResultT = z.infer<typeof ActionResult>;
