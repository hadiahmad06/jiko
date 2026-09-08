// src/types/usage/Usage.ts
import { z } from "zod";

export const AppLabel = z.enum(["distracting", "work", "neutral"]);
export type AppLabelT = z.infer<typeof AppLabel>;

export const AppLabelSet = z.object({
  labels: z.array(z.object({ bundle_id: z.string().min(1), label: AppLabel })).min(1).max(200),
});

export const UsageDailyRow = z.object({
  user_id: z.uuid(),
  day: z.string(),
  device_id: z.string(),
  bundle_id: z.string(),
  app_name: z.string().nullable(),
  category: z.string().nullable(),
  seconds: z.number().int(),
  opens: z.number().int(),
});
export type UsageDailyRowT = z.infer<typeof UsageDailyRow>;

export const UsageSummaryQuery = z.object({
  // 0 = today in the user's timezone
  days_ago: z.coerce.number().int().min(0).max(30).default(0),
});

export interface UsageSummary {
  day: string;
  timezone: string;
  total_seconds: number;
  by_label: Record<AppLabelT | "unlabeled", number>;
  top_apps: Array<{ bundle_id: string; app_name: string | null; label: AppLabelT | null; seconds: number; opens: number }>;
  focus_minutes: number;          // minutes in activity entries that day
  obligations_due_soon: number;   // due within 48h, not completed
}
