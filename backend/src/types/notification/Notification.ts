import { z } from "zod";

// NOTIFICATIONS table schema
export const Notification = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  message: z.string(),
  is_read: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});
