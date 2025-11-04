import { z } from "zod";

// ACTIVITIES table schema
export const Activity = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string(),
  description: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});
