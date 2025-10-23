import { z } from 'zod';
import type { AppUsageUpdate } from './AppUsageUpdate';
import { AppUsageUpdateSchema } from './AppUsageUpdate';
import type { Platform } from './Platform';
import { PlatformSchema } from './Platform';

// ---------------------------
// User Zod schema
// ---------------------------
export const UserSchema = z.object({
  uuid: z.string(),
  phoneNumber: z.string(),
  email: z.string().optional(),
  username: z.string().optional(),
  appUsage: z.partialRecord(PlatformSchema, AppUsageUpdateSchema)
  .optional()
  .transform((val) => val ?? {} as Record<Platform, AppUsageUpdate>),
});

// TypeScript type inferred from schema
export type User = z.infer<typeof UserSchema>;

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