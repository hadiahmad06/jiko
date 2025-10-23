import { z } from 'zod';

// Individual app usage activity (currentActivity representation)
export const CurrentActivitySchema = z.object({
  bundleId: z.string(),
  appName: z.string(),
  startTime: z.string(),          // ISO timestamp
  durationSeconds: z.number(),
  category: z.string().optional(),
  isForeground: z.boolean().optional(),
  windowTitle: z.string().optional(),
});

// TypeScript type inferred
export type CurrentActivity = z.infer<typeof CurrentActivitySchema>;