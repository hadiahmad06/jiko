import { z } from 'zod';
import { Platform } from '../device/Platform.js';
import { mergeArray } from '../../common/common.js';

export const AppUsageLog = z.object({
  bundleId: z.string(),
  timestamp: z.string(),
  appName: z.string(),
  startTime: z.string(),          // ISO timestamp
  durationSeconds: z.number(),
  category: z.string().optional(),
  isForeground: z.boolean().optional(),
  windowTitle: z.string().optional(),
});

// TypeScript type inferred
export type AppUsageLogT = z.infer<typeof AppUsageLog>;

export const AppUsageData = z.object({
  timestamp: z.string(),  // represents the last updated time
  platform: Platform,
  device_id: z.string(),
  log: z.array(AppUsageLog), // ios or mac only
});

export type AppUsageDataT = z.infer<typeof AppUsageData>;

// device_id -> AppUsageDataT
export const AppUsageRecord = z.record(z.string(), AppUsageData);
export type AppUsageRecordT = z.infer<typeof AppUsageRecord>;


export function appendAppUsage(
  oldData: AppUsageDataT | undefined,
  newData: AppUsageDataT,
  maxEntries?: number,
  maxAgeSec?: number
): AppUsageDataT {

  const merged = mergeArray(
    oldData?.log,
    newData.log,
    (d: AppUsageLogT) => { return d.timestamp },
    maxEntries,
    maxAgeSec
  )

  return {
    ...newData,
    log: merged
  }
}