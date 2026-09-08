// src/services/repositories/UsageRepository.ts
//
// Durable rollups of app usage. The raw per-sync payload lives in AppUsageManager's
// in-memory cache; this table is what summaries and conditions read across days.
import { query } from '../../db/psqlClient.js';
import { AppLabelT, UsageDailyRowT } from '../../types/usage/Usage.js';
import { AppUsageLogT } from '../../types/user/sync/AppUsageData.js';

export interface UsageDelta {
  bundle_id: string;
  app_name?: string | undefined;
  category?: string | undefined;
  seconds: number;
  opens: number;
}

/** Local calendar day (YYYY-MM-DD) for an instant in a timezone. */
export function localDay(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Collapses a sync payload's logs into per-app deltas, one bucket per local day. */
export function deltasByDay(logs: AppUsageLogT[], timezone: string): Map<string, Map<string, UsageDelta>> {
  const days = new Map<string, Map<string, UsageDelta>>();
  for (const log of logs) {
    const start = new Date(log.startTime || log.timestamp);
    if (Number.isNaN(start.getTime())) continue;
    const day = localDay(start, timezone);
    let apps = days.get(day);
    if (!apps) { apps = new Map(); days.set(day, apps); }
    const cur = apps.get(log.bundleId) ?? { bundle_id: log.bundleId, app_name: log.appName, category: log.category, seconds: 0, opens: 0 };
    cur.seconds += Math.max(0, Math.round(log.durationSeconds));
    cur.opens += 1;
    if (!cur.app_name && log.appName) cur.app_name = log.appName;
    apps.set(log.bundleId, cur);
  }
  return days;
}

class UsageRepository {
  async addDeltas(user_id: string, device_id: string, day: string, deltas: Iterable<UsageDelta>): Promise<void> {
    for (const d of deltas) {
      await query(
        `INSERT INTO app_usage_daily (user_id, day, device_id, bundle_id, app_name, category, seconds, opens)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, day, device_id, bundle_id) DO UPDATE SET
           seconds = app_usage_daily.seconds + EXCLUDED.seconds,
           opens = app_usage_daily.opens + EXCLUDED.opens,
           app_name = COALESCE(EXCLUDED.app_name, app_usage_daily.app_name),
           category = COALESCE(EXCLUDED.category, app_usage_daily.category),
           updated_at = NOW()`,
        [user_id, day, device_id, d.bundle_id, d.app_name ?? null, d.category ?? null, d.seconds, d.opens]
      );
      await query(
        `INSERT INTO seen_apps (user_id, bundle_id, app_name) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, bundle_id) DO UPDATE SET last_seen = NOW(), app_name = COALESCE(EXCLUDED.app_name, seen_apps.app_name)`,
        [user_id, d.bundle_id, d.app_name ?? null]
      );
    }
  }

  async forDay(user_id: string, day: string): Promise<Array<UsageDailyRowT & { label: AppLabelT | null }>> {
    const res = await query(
      `SELECT u.user_id, u.day::text AS day, u.device_id, u.bundle_id, u.app_name, u.category, u.seconds, u.opens, l.label
       FROM app_usage_daily u LEFT JOIN app_labels l ON l.user_id = u.user_id AND l.bundle_id = u.bundle_id
       WHERE u.user_id = $1 AND u.day = $2 ORDER BY u.seconds DESC`,
      [user_id, day]
    );
    return res.rows as Array<UsageDailyRowT & { label: AppLabelT | null }>;
  }

  async secondsForDay(user_id: string, day: string, opts: { bundle_id?: string; label?: AppLabelT } = {}): Promise<number> {
    const vals: unknown[] = [user_id, day];
    const conds = ['u.user_id = $1', 'u.day = $2'];
    if (opts.bundle_id) { vals.push(opts.bundle_id); conds.push(`u.bundle_id = $${vals.length}`); }
    if (opts.label) { vals.push(opts.label); conds.push(`l.label = $${vals.length}`); }
    const res = await query<{ s: number }>(
      `SELECT COALESCE(SUM(u.seconds), 0)::int AS s FROM app_usage_daily u
       LEFT JOIN app_labels l ON l.user_id = u.user_id AND l.bundle_id = u.bundle_id
       WHERE ${conds.join(' AND ')}`,
      vals
    );
    return res.rows[0]?.s ?? 0;
  }

  async labels(user_id: string): Promise<Record<string, AppLabelT>> {
    const res = await query<{ bundle_id: string; label: AppLabelT }>('SELECT bundle_id, label FROM app_labels WHERE user_id = $1', [user_id]);
    return Object.fromEntries(res.rows.map(r => [r.bundle_id, r.label]));
  }

  async setLabels(user_id: string, labels: Array<{ bundle_id: string; label: AppLabelT }>): Promise<void> {
    for (const l of labels) {
      await query(
        `INSERT INTO app_labels (user_id, bundle_id, label) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, bundle_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW()`,
        [user_id, l.bundle_id, l.label]
      );
    }
  }

  async seenApps(user_id: string): Promise<Array<{ bundle_id: string; app_name: string | null; label: AppLabelT | null; last_seen: Date }>> {
    const res = await query(
      `SELECT s.bundle_id, s.app_name, l.label, s.last_seen FROM seen_apps s
       LEFT JOIN app_labels l ON l.user_id = s.user_id AND l.bundle_id = s.bundle_id
       WHERE s.user_id = $1 ORDER BY s.last_seen DESC`,
      [user_id]
    );
    return res.rows as Array<{ bundle_id: string; app_name: string | null; label: AppLabelT | null; last_seen: Date }>;
  }

  /** Minutes logged in activity entries overlapping a local day (approximate: by start_time). */
  async focusMinutesForDay(user_id: string, day: string, timezone: string): Promise<number> {
    const res = await query<{ m: number }>(
      `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time)) / 60), 0)::int AS m
       FROM activity_entries WHERE user_id = $1 AND (start_time AT TIME ZONE $3)::date = $2::date`,
      [user_id, day, timezone]
    );
    return res.rows[0]?.m ?? 0;
  }
}

export default new UsageRepository();
