import { z } from 'zod';
import { CurrentActivity } from './CurrentActivity.js';
import { Platform } from '../device/Platform.js';

// AppUsageUpdate extended with currentActivity
// stateless schema
export const AppUsageUpdate = z.object({
  timestamp: z.string(),
  platform: Platform,
  deviceId: z.string().optional(),
  currentActivity: z.array(CurrentActivity).optional(), // ios or mac only
});

export type AppUsageUpdateT = z.infer<typeof AppUsageUpdate>;

// AppUsageRecord mapping keys to updates
export const AppUsageRecord = z.record(z.string(), AppUsageUpdate);
export type AppUsageRecordT = z.infer<typeof AppUsageRecord>;