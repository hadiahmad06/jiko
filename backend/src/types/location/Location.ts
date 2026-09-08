// src/types/location/Location.ts
import { z } from "zod";
import crypto from "crypto";

export const Location = z.object({
  id: z.uuid().default(() => crypto.randomUUID()),
  user_id: z.uuid(),
  name: z.string().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_m: z.number().int().positive().max(100_000),
  archived: z.boolean().default(false),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});
export type LocationT = z.infer<typeof Location>;

export const LocationCreate = Location.pick({ name: true, latitude: true, longitude: true, radius_m: true });
export type LocationCreateT = z.infer<typeof LocationCreate>;

export const LocationUpdate = LocationCreate.partial().extend({ archived: z.boolean().optional() }).strict();
export type LocationUpdateT = z.infer<typeof LocationUpdate>;
