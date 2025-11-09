import { z } from 'zod';
import type { AppUsageUpdateT } from '../appUsage/AppUsageUpdate.js';
import { AppUsageUpdate } from '../appUsage/AppUsageUpdate.js';
import type { PlatformT } from '../device/Platform.js';
import { Platform } from '../device/Platform.js';

// USERS table schema
export const User = z.object({
  id: z.string(),
  phone_number: z.string(),
  password_hash: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  display_name: z.string().optional(),
  nickname: z.string().optional(),
  appUsage: z.partialRecord(Platform, AppUsageUpdate)
  .optional()
  .transform((val) => val ?? {} as Record<PlatformT, AppUsageUpdateT>),
});

export type UserT = z.infer<typeof User>;

// ---------------------------
// example usage
// ---------------------------
// const user: User = UserSchema.parse({
//   uuid: 'user-123',
//   phoneNumber: '+1234567890',
//   appUsage: {}
// });

// // update with an iOS activity
// const iosUpdate: AppUsageUpdate = {
//   timestamp: new Date().toISOString(),
//   platform: 'ios',
//   currentActivity: [
//     { bundleId: 'com.roblox.ios', appName: 'Roblox', startTime: new Date().toISOString(), durationSeconds: 30, isForeground: true }
//   ]
// };

// user.appUsage!['ios'] = iosUpdate; // overwrites any previous iOS record

// // update with a macOS activity
// const macUpdate: AppUsageUpdate = {
//   timestamp: new Date().toISOString(),
//   platform: 'macos',
//   currentActivity: [
//     { bundleId: 'com.roblox.macos', appName: 'Roblox', startTime: new Date().toISOString(), durationSeconds: 45, isForeground: true }
//   ]
// };

// user.appUsage['macos'] = macUpdate; // overwrites any previous macOS record