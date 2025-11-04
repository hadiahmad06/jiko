import { z } from "zod";

// TASKS table schema
export const Task = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  title: z.string(),
  description: z.string(),
  is_completed: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});