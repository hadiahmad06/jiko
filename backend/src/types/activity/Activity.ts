import { z } from "zod";
import crypto from "crypto";

// ACTIVITIES table schema
export const Activity = z.object({
  id: z.uuid().default(() => crypto.randomUUID()),
  user_id: z.uuid(),
  name: z.string(),
  description: z.string(),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
});

export type ActivityT = z.infer<typeof Activity>;

export const ActivityExample: ActivityT = {
  id: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  name: 'Morning Workout',
  description: 'A 60-minute full-body workout routine',
  created_at: new Date('2025-11-04T08:00:00Z'),
  updated_at: new Date('2025-11-04T09:00:00Z'),
};
