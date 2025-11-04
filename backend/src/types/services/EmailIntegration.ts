import { z } from "zod";

// EMAIL_INTEGRATIONS table schema
export const EmailIntegration = z.object({
  id: z.uuid(),
  user_preference_id: z.uuid(),
  email_address: z.string(),
  is_verified: z.number(),
  created_at: z.date(),
  updated_at: z.date(),
});
