// src/services/triggers/schedule.ts
import { ScheduledMatchT } from '../../types/trigger/Trigger.js';

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 } as const;

/** First run for a newly created scheduled trigger: `at`, or the next occurrence after now. */
export function firstRun(match: ScheduledMatchT, _now: Date): Date {
  // A past `at` is due immediately (one catch-up run); recurrence then computes forward from it.
  return new Date(match.at);
}

/** Next run strictly after `now`, or null for one-shots. */
export function nextRun(match: ScheduledMatchT, now: Date): Date | null {
  if (!match.recurrence) return null;
  const step = match.recurrence.interval * UNIT_MS[match.recurrence.unit];
  const base = new Date(match.at).getTime();
  if (base > now.getTime()) return new Date(base);
  const k = Math.floor((now.getTime() - base) / step) + 1;
  return new Date(base + k * step);
}
