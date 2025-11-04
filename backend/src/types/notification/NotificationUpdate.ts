import { z } from "zod";

// NOTIFICATION_HISTORY table schema
export const NotificationUpdate = z.object({
  id: z.uuid(),
  notification_id: z.uuid(),
  sent_at: z.date(),
  status: z.string(),
});