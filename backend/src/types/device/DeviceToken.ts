import { z } from "zod";

// DEVICE_TOKENS table schema
export const DeviceToken = z.object({
  id: z.uuid(),
  device_id: z.uuid(),
  token: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});
