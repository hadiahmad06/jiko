import { z } from "zod";

// ACTIVITY_ENTRIES table schema
export const ActivityEntry = z.object({
  id: z.uuid(),
  activity_id: z.uuid(),
  start_time: z.date(),
  end_time: z.date(),
  notes: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});