import { z } from "zod";
import { Platform } from "./Platform";

// DEVICES table schema
export const Device = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  device_token: z.string(),
  device_type: Platform,
  last_active: z.coerce.date().nullable().optional(),
});

