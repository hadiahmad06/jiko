import { z } from "zod";

// USER_PREFERENCES table schema
export const UserPreferences = z.object({
  user_id: z.uuid(),
  language: z.string(),
  timezone: z.string(),
  strictness: z.float64(),
  intervention_level: z.float64(),
});