import { z } from "zod";

// CALENDAR_INTEGRATIONS table schema
export const CalendarIntegration = z.object({
  id: z.uuid(),
  user_preference_id: z.uuid(),
  calendar_service: z.string(),
  calendar_id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});
