import { z } from 'zod';

// Individual app usage activity (currentActivity representation)
// stateless schema
export const CurrentActivity = z.object({
  bundleId: z.string(),
  appName: z.string(),
  startTime: z.string(),          // ISO timestamp
  durationSeconds: z.number(),
  category: z.string().optional(),
  isForeground: z.boolean().optional(),
  windowTitle: z.string().optional(),
});

// TypeScript type inferred
export type CurrentActivityT = z.infer<typeof CurrentActivity>;