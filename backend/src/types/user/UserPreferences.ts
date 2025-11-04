import { z } from "zod";

// USER_PREFERENCES table schema
export const UserPreferences = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  preference_key: z.string(),
  preference_value: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});