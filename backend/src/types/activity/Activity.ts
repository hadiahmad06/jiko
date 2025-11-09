import { z } from "zod";
import crypto from "crypto";

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
