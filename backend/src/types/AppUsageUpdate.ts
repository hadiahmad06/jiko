import { z } from 'zod';
import { CurrentActivitySchema } from './CurrentActivity';
import { PlatformSchema } from './Platform';

// AppUsageUpdate extended with currentActivity
export const AppUsageUpdateSchema = z.object({
  timestamp: z.string(),
  platform: PlatformSchema,
  deviceId: z.string().optional(),
  currentActivity: z.array(CurrentActivitySchema).optional(), // ios or mac only
});

// TypeScript type inferred
export type AppUsageUpdate = z.infer<typeof AppUsageUpdateSchema>;

// AppUsageRecord mapping keys to updates
export const AppUsageRecordSchema = z.record(z.string(), AppUsageUpdateSchema);
export type AppUsageRecord = z.infer<typeof AppUsageRecordSchema>;