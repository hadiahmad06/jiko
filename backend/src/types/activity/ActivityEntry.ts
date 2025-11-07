import { z } from "zod";
import { ActivityExample } from "./Activity.js";
import crypto from "crypto";

// ACTIVITY_ENTRIES table schema
export const ActivityEntry = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  activity_id: z.uuid(),
  start_time: z.date(),
  end_time: z.date().optional(),
  notes: z.string().optional(),
  logged_by: z.enum(['user', 'system', 'trigger']),
  ended_by: z.enum(['user', 'system', 'trigger']).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type ActivityEntryT = z.infer<typeof ActivityEntry>;

export const EntriesExamples: ActivityEntryT[] = [
  {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    activity_id: ActivityExample.id,
    start_time: new Date('2025-11-04T08:00:00Z'),
    end_time: new Date('2025-11-04T09:00:00Z'),
    notes: 'Felt great, completed all exercises',
    logged_by: "user",
    confidence_score: 1,
    created_at: new Date('2025-11-04T09:00:00Z'),
    updated_at: new Date('2025-11-04T09:00:00Z'),
  },
  {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    activity_id: ActivityExample.id,
    start_time: new Date('2025-11-05T08:00:00Z'),
    end_time: new Date('2025-11-05T09:00:00Z'),
    notes: 'Skipped a few exercises, felt tired',
    logged_by: "user",
    confidence_score: 0.8,
    created_at: new Date('2025-11-05T09:00:00Z'),
    updated_at: new Date('2025-11-05T09:00:00Z'),
  },
  {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    activity_id: ActivityExample.id,
    start_time: new Date('2025-11-06T08:00:00Z'),
    end_time: new Date('2025-11-06T09:00:00Z'),
    logged_by: "user",
    confidence_score: 0.5,
    created_at: new Date('2025-11-06T09:00:00Z'),
    updated_at: new Date('2025-11-06T09:00:00Z'),
  }

];