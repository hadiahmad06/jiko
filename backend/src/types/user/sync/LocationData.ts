import { Platform } from "../device/Platform";
import z from "zod";

// Location data schema
export const LocationData = z.object({
  timestamp: z.string(),     // ISO timestamp
  platform: Platform,
  device_id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radius: z.number(),
  altitude: z.number().optional(),
});

export type LocationDataT = z.infer<typeof LocationData>;
