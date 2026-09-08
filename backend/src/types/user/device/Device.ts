// src/types/user/device/Device.ts
import { z } from "zod";
import crypto from "crypto";
import { Platform } from "./Platform.js";

export const Device = z.object({
  id: z.uuid().default(() => crypto.randomUUID()),
  user_id: z.uuid(),
  platform: Platform,
  name: z.string().max(120).nullable().optional(),
  push_token: z.string().nullable().optional(),
  last_seen_at: z.coerce.date().nullable().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});
export type DeviceT = z.infer<typeof Device>;

export const DeviceRegister = z.object({
  // Client may supply a stable id (e.g. hardware UUID) so re-registration is idempotent.
  id: z.uuid().optional(),
  platform: Platform,
  name: z.string().max(120).optional(),
  push_token: z.string().optional(),
});
export type DeviceRegisterT = z.infer<typeof DeviceRegister>;

export const DeviceUpdate = z.object({
  name: z.string().max(120).optional(),
  push_token: z.string().nullable().optional(),
}).strict();
