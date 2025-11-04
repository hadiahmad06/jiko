import { z } from "zod";

// DEVICES table schema
export const Device = z.object({
  id: z.uuid(),
  user_preference_id: z.uuid(),
  device_name: z.string(),
  device_type: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

