import { z } from "zod";
import crypto from "crypto";
import { ActivityEntry } from "./ActivityEntry";

// ACTIVITIES table schema
export const Activity = z.object({
  id: z.uuid().optional().default(() => crypto.randomUUID()),
  user_id: z.uuid(),
  name: z.string(),
  description: z.string().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
})

export type ActivityT = z.infer<typeof Activity>;

export const ActivityExample: ActivityT = {
  id: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  name: 'Morning Workout',
  description: 'A 60-minute full-body workout routine'
};

export const PartialActivityWithIds = Activity
  .partial()
  .extend({
    id: z.uuid(),
    user_id: z.uuid()
  });

export type PartialActivityWithIdsT = z.infer<typeof PartialActivityWithIds>;

export const ActivityQuery = z.object({
  activityIds: z.array(z.uuid()).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().optional()
});

export type ActivityQueryT = z.infer<typeof ActivityQuery>;