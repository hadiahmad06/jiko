// src/types/obligation/Obligation.ts
// One table, three kinds. See db/migrations/0001_baseline.sql.
import { z } from "zod";
import crypto from "crypto";

export const ObligationKind = z.enum(["task", "event", "goal"]);
export type ObligationKindT = z.infer<typeof ObligationKind>;

export const Obligation = z.object({
  id: z.uuid().default(() => crypto.randomUUID()),
  user_id: z.uuid(),
  kind: ObligationKind,
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  due_at: z.coerce.date().nullable().optional(),
  start_at: z.coerce.date().nullable().optional(),
  end_at: z.coerce.date().nullable().optional(),
  all_day: z.boolean().default(false),
  location_id: z.uuid().nullable().optional(),
  activity_id: z.uuid().nullable().optional(),
  target_minutes: z.number().int().positive().nullable().optional(),
  timeframe_days: z.number().int().positive().nullable().optional(),
  intervention_level: z.number().min(0).max(1).default(0.5),
  completed: z.boolean().default(false),
  completed_at: z.coerce.date().nullable().optional(),
  archived: z.boolean().default(false),
  source: z.string().default("user"),
  external_ref: z.string().nullable().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
}).superRefine((o, ctx) => {
  if (o.kind === "task" && !o.due_at) ctx.addIssue({ code: "custom", path: ["due_at"], message: "tasks need due_at" });
  if (o.kind === "event" && !o.start_at) ctx.addIssue({ code: "custom", path: ["start_at"], message: "events need start_at" });
  if (o.kind === "goal" && (!o.target_minutes || !o.timeframe_days)) ctx.addIssue({ code: "custom", path: ["target_minutes"], message: "goals need target_minutes and timeframe_days" });
});
export type ObligationT = z.infer<typeof Obligation>;

export const ObligationCreate = z.object({
  kind: ObligationKind.default("task"),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  due_at: z.coerce.date().optional(),
  start_at: z.coerce.date().optional(),
  end_at: z.coerce.date().optional(),
  all_day: z.boolean().optional(),
  location_id: z.uuid().optional(),
  activity_id: z.uuid().optional(),
  target_minutes: z.number().int().positive().optional(),
  timeframe_days: z.number().int().positive().optional(),
  intervention_level: z.number().min(0).max(1).optional(),
  source: z.string().optional(),
  external_ref: z.string().optional(),
});
export type ObligationCreateT = z.infer<typeof ObligationCreate>;

export const ObligationUpdate = ObligationCreate.partial().extend({
  completed: z.boolean().optional(),
  archived: z.boolean().optional(),
}).strict();
export type ObligationUpdateT = z.infer<typeof ObligationUpdate>;

export const ObligationQuery = z.object({
  kind: ObligationKind.optional(),
  completed: z.coerce.boolean().optional(),
  archived: z.coerce.boolean().optional().default(false),
  due_before: z.coerce.date().optional(),
  due_after: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});
export type ObligationQueryT = z.infer<typeof ObligationQuery>;
