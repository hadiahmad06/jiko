import { z } from "zod";

// EVENTS table schema
export const Event = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  title: z.string(),
  description: z.string(),
  start_time: z.date(),
  end_time: z.date(),
  created_at: z.date(),
  updated_at: z.date(),
});
