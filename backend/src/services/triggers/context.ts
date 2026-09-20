// src/services/triggers/context.ts
//
// Everything a matcher/condition/action may need about the user at evaluation
// time. Expensive lookups are memoised per evaluation so a trigger list with
// twenty conditions doesn't hit Postgres twenty times.
import { AppUsageDataT, AppUsageLogT } from '../../types/user/sync/AppUsageData.js';
import { LocationDataT } from '../../types/user/sync/LocationData.js';
import { HealthDataT } from '../../types/user/sync/HealthData.js';
import { UserPreferencesT } from '../../types/user/UserPreferences.js';
import { ObligationT } from '../../types/obligation/Obligation.js';
import { TriggerT } from '../../types/trigger/Trigger.js';
import { AppLabelT } from '../../types/usage/Usage.js';
import PreferencesRepository from '../repositories/PreferencesRepository.js';
import ObligationRepository from '../repositories/ObligationRepository.js';
import LocationRepository from '../repositories/LocationRepository.js';
import UsageRepository from '../repositories/UsageRepository.js';
import ActivityRepository from '../ActivityRepository.js';
import { query } from '../../db/psqlClient.js';

export type SyncEvent =
  | { kind: 'app_usage'; data: AppUsageDataT; allDevices: AppUsageDataT[] }
  | { kind: 'location'; previous: LocationDataT | null; current: LocationDataT }
  | { kind: 'health'; data: HealthDataT; allDevices: HealthDataT[] }
  | { kind: 'scheduled' }
  | { kind: 'obligation'; obligation: ObligationT }
  | { kind: 'manual' };

/** A goal obligation with its window's worth of logged minutes filled in. */
export interface GoalProgress {
  goal_id: string;
  title: string;
  activity_id: string;
  target_minutes: number;
  logged_minutes: number;
  remaining_minutes: number;
  percent: number;          // 0-100+, logged / target
  timeframe_days: number;
  elapsed_fraction: number; // how far into the window we are, 0-1
  window_start: Date;
}

export interface TriggerContext {
  user_id: string;
  now: Date;
  event: SyncEvent;
  prefs: UserPreferencesT;
  /** Filled in by the matcher so templates can say which app / location fired. */
  matched: {
    app?: { bundle_id: string; app_name: string; minutes: number };
    location?: { id: string; name: string; event: 'enter' | 'exit' };
    obligation?: ObligationT;
    metric?: { name: string; value: number };
    goal?: GoalProgress;
  };
  /** Set while a specific trigger is being evaluated. */
  trigger?: TriggerT;

  // memoised lookups
  appLogs(): AppUsageLogT[];
  labels(): Promise<Record<string, AppLabelT>>;
  obligationsDueWithin(hours: number, kind?: ObligationT['kind'], minLevel?: number): Promise<ObligationT[]>;
  openGoals(activity_id?: string): Promise<ObligationT[]>;
  goalProgress(goal: ObligationT, timeframeDays?: number): Promise<GoalProgress | null>;
  locationsContaining(lat: number, lon: number): Promise<string[]>;
  currentLocation(): LocationDataT | null;
  openActivityEntries(): Promise<Array<{ id: string; activity_id: string; start_time: Date }>>;
  healthMetric(metric: string, windowHours: number): number | null;
  userName(): Promise<string>;
}

export async function buildContext(user_id: string, event: SyncEvent, opts: { now?: Date; appUsage?: AppUsageDataT[]; health?: HealthDataT[]; lastLocation?: LocationDataT | null } = {}): Promise<TriggerContext> {
  const now = opts.now ?? new Date();
  const prefs = await PreferencesRepository.get(user_id);
  const memo = new Map<string, unknown>();
  const once = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key) as Promise<T>;
  };

  const appUsageAll: AppUsageDataT[] = event.kind === 'app_usage' ? event.allDevices : (opts.appUsage ?? []);
  const healthAll: HealthDataT[] = event.kind === 'health' ? event.allDevices : (opts.health ?? []);

  const ctx: TriggerContext = {
    user_id,
    now,
    event,
    prefs,
    matched: {},
    appLogs: () => appUsageAll.flatMap(d => d.log),
    labels: () => once('labels', () => UsageRepository.labels(user_id)),
    obligationsDueWithin: (hours, kind, minLevel = 0) => once(`obl:${hours}:${kind ?? ''}:${minLevel}`, () => ObligationRepository.dueWithin(user_id, hours, kind, minLevel)),
    openGoals: (activity_id) => once(`goals:${activity_id ?? ''}`, () => ObligationRepository.openGoals(user_id, activity_id)),
    goalProgress: (goal, timeframeDays) => once(`goalp:${goal.id}:${timeframeDays ?? ''}`, () => computeGoalProgress(user_id, goal, now, timeframeDays)),
    locationsContaining: (lat, lon) => once(`loc:${lat.toFixed(5)}:${lon.toFixed(5)}`, () => LocationRepository.containing(user_id, lat, lon)),
    currentLocation: () => (event.kind === 'location' ? event.current : (opts.lastLocation ?? null)),
    openActivityEntries: () => once('open-entries', () => ActivityRepository.openEntries(user_id)),
    healthMetric: (metric, windowHours) => latestMetric(healthAll, metric, now, windowHours),
    userName: () => once('name', async () => {
      const res = await query<{ nickname: string | null; display_name: string | null }>('SELECT nickname, display_name FROM users WHERE id = $1', [user_id]);
      return res.rows[0]?.nickname || res.rows[0]?.display_name || 'you';
    }),
  };
  return ctx;
}

/**
 * Minutes logged for a goal's activity inside its rolling window. A goal with
 * no activity or no target can't be measured, so it yields null rather than a
 * misleading zero.
 */
async function computeGoalProgress(user_id: string, goal: ObligationT, now: Date, timeframeDaysOverride?: number): Promise<GoalProgress | null> {
  const target = goal.target_minutes ?? 0;
  const days = timeframeDaysOverride ?? goal.timeframe_days ?? 7;
  if (!goal.activity_id || target <= 0 || days <= 0) return null;
  const window_start = new Date(now.getTime() - days * 86_400_000);
  const logged = await ActivityRepository.minutesLogged(user_id, goal.activity_id, window_start, now);
  // Elapsed within the *current* period, so a weekly goal read on thursday is
  // ~0.57 rather than always 1.
  const periodMs = days * 86_400_000;
  const anchor = goal.created_at ? new Date(goal.created_at).getTime() : window_start.getTime();
  const elapsed = ((now.getTime() - anchor) % periodMs) / periodMs;
  return {
    goal_id: goal.id,
    title: goal.title,
    activity_id: goal.activity_id,
    target_minutes: target,
    logged_minutes: Math.round(logged),
    remaining_minutes: Math.max(0, Math.round(target - logged)),
    percent: Math.round((logged / target) * 100),
    timeframe_days: days,
    elapsed_fraction: Number.isFinite(elapsed) ? Math.min(1, Math.max(0, elapsed)) : 1,
    window_start,
  };
}

function latestMetric(health: HealthDataT[], metric: string, now: Date, windowHours: number): number | null {
  const cutoff = now.getTime() - windowHours * 3600_000;
  let best: { t: number; v: number } | null = null;
  for (const d of health) {
    for (const log of d.log) {
      const raw = (log as Record<string, unknown>)[metric];
      const v = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (Number.isNaN(v)) continue;
      const rec = log as Record<string, string | undefined>;
      const t = new Date(rec.end_time ?? rec.timestamp ?? 0).getTime();
      if (t < cutoff) continue;
      if (!best || t > best.t) best = { t, v };
    }
  }
  return best?.v ?? null;
}

/** Seconds of foreground use per bundle id within the last `windowMinutes`. */
export function usageWindow(logs: AppUsageLogT[], now: Date, windowMinutes: number): Map<string, { seconds: number; app_name: string; last: number }> {
  const cutoff = now.getTime() - windowMinutes * 60_000;
  const out = new Map<string, { seconds: number; app_name: string; last: number }>();
  for (const log of logs) {
    if (log.isForeground === false) continue;
    const start = new Date(log.startTime || log.timestamp).getTime();
    if (Number.isNaN(start)) continue;
    const end = start + Math.max(0, log.durationSeconds) * 1000;
    if (end < cutoff) continue;
    // clip to window
    const seconds = Math.max(0, (end - Math.max(start, cutoff)) / 1000);
    const cur = out.get(log.bundleId) ?? { seconds: 0, app_name: log.appName, last: 0 };
    cur.seconds += seconds;
    cur.last = Math.max(cur.last, end);
    out.set(log.bundleId, cur);
  }
  return out;
}
