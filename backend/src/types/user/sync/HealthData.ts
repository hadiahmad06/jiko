// designed for both apple health and android health connect

import { mergeArray } from "../../common/common";
import { Platform } from "../device/Platform";
import z from "zod";

// designed for android History Data only.
export const HealthLog = z.object({
  timestamp: z.string(),     // ? same as end_time, will remove when im sure its unneeded
  start_time: z.string(),    // the time at which the data in the log begins counting
  end_time: z.string(),      // the time at which the data in the log stops counting
  tags: z.array(z.string()).optional()
}).catchall(z.union([z.string(), z.number()])).transform((data) => {
  // Convert array values to JSON strings to satisfy the index signature
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as any;
});

export const HealthData = z.object({
  timestamp: z.string(), // represents the last updated time for the given device_id
  platform: Platform,
  device_id: z.string(),
  log: z.array(HealthLog)
});

// { device_id -> list of HealthDataT (aggregated)}
export const HealthRecord = z.record(z.string(), HealthData);

export type HealthLogT = z.infer<typeof HealthLog>;
export type HealthRecordT = z.infer<typeof HealthRecord>;
export type HealthDataT = z.infer<typeof HealthData>;

export function appendHealth(
  oldData: HealthDataT | undefined,
  newData: HealthDataT,
  maxEntries?: number,
  maxAgeSec?: number
): HealthDataT {

  const merged = mergeArray(
    oldData?.log,
    newData.log,
    (d: HealthLogT) => { return d.timestamp },
    maxEntries,
    maxAgeSec
  )

  return {
    ...newData,
    log: merged
  }
}