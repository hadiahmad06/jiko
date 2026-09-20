// src/services/triggers/scheduler.ts
//
// Periodic sweep for the work no device sync wakes up:
//   - scheduled triggers: next_run_at <= now
//   - obligation triggers: something is due within the hours_before window
//   - calendar subscriptions whose refresh window has elapsed
// Started from index.ts when ENABLE_SCHEDULER=true.
import cron from 'node-cron';
import TriggerRepository from '../repositories/TriggerRepository.js';
import ObligationRepository from '../repositories/ObligationRepository.js';
import { buildContext } from './context.js';
import { runOne, FiringReport } from './engine.js';
import AppUsageManager from '../../data/AppUsageManager.js';
import HealthManager from '../../data/HealthManager.js';
import LocationManager from '../../data/LocationManager.js';
import { getPool, query } from '../../db/psqlClient.js';
import { refreshDueCalendars } from '../calendars.js';
import { log } from '../../lib/log.js';

let running = false;

// Postgres advisory lock key. Two instances can both run the API; only one
// sweeps, or every scheduled nudge is sent twice. The lock is transaction
// scoped, so a crashed instance releases it when its connection drops.
const SWEEP_LOCK_KEY = Number(process.env.JIKO_SWEEP_LOCK_KEY || 8_675_309);

/**
 * Runs `fn` only if this process wins the sweep lock. Returns null when
 * another instance holds it. Falls back to running (single-instance
 * behaviour) if the lock query itself fails.
 */
async function withSweepLock<T>(fn: () => Promise<T>): Promise<T | null> {
  let pool;
  try {
    pool = await getPool();
  } catch {
    return fn();
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_xact_lock($1) AS ok', [SWEEP_LOCK_KEY]);
    if (!res.rows[0]?.ok) {
      await client.query('ROLLBACK');
      return null;
    }
    // The lock is held until this transaction ends, i.e. until fn resolves.
    return await fn();
  } finally {
    try { await client.query('COMMIT'); } catch { /* connection already gone */ }
    client.release();
  }
}

export async function sweepOnce(now = new Date()): Promise<FiringReport[]> {
  if (running) return [];
  running = true;
  const reports: FiringReport[] = [];
  try {
    // calendar subscriptions first: a freshly imported deadline should be
    // visible to the triggers evaluated in this same sweep
    try {
      const imports = await refreshDueCalendars(now);
      for (const r of imports) {
        if (r.status === 'error') log.warn('calendar import failed', { event: 'calendar_import', subscription_id: r.subscription_id, error: r.error });
      }
    } catch (err) {
      log.fail('calendar refresh failed', err, { event: 'calendar_refresh' });
    }

    // scheduled
    for (const trigger of await TriggerRepository.dueScheduled(now)) {
      const ctx = await buildContext(trigger.user_id, { kind: 'scheduled' }, snapshotOpts(trigger.user_id, now));
      const r = await runOne(trigger, ctx);
      if (r) reports.push(r);
      else if (trigger.next_run_at && new Date(trigger.next_run_at) <= now) {
        // matched-but-blocked (condition/cooldown): still advance so it doesn't spin every tick
        const { nextRun } = await import('./schedule.js');
        if (trigger.kind === 'scheduled') await TriggerRepository.update(trigger.id, trigger.user_id, { next_run_at: nextRun(trigger.match, now) });
      }
    }
    // obligation
    for (const trigger of await TriggerRepository.allEnabledOfKind('obligation')) {
      if (trigger.kind !== 'obligation') continue;
      const due = await ObligationRepository.dueWithin(trigger.user_id, trigger.match.hours_before, trigger.match.kind);
      for (const obligation of due) {
        const already = await query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM trigger_firings WHERE trigger_id = $1 AND context->'matched'->>'obligation_id' = $2`,
          [trigger.id, obligation.id]
        );
        if ((already.rows[0]?.n ?? 0) > 0) continue;
        const ctx = await buildContext(trigger.user_id, { kind: 'obligation', obligation }, snapshotOpts(trigger.user_id, now));
        const r = await runOne(trigger, ctx);
        if (r) reports.push(r);
      }
    }
  } catch (err) {
    log.fail('sweep failed', err, { event: 'sweep' });
  } finally {
    running = false;
  }
  return reports;
}

function snapshotOpts(user_id: string, now: Date) {
  return {
    now,
    appUsage: AppUsageManager.snapshot(user_id),
    health: HealthManager.snapshot(user_id),
    lastLocation: LocationManager.last(user_id),
  };
}

/** One sweep, but only on the instance that holds the advisory lock. */
export async function sweepIfLeader(now = new Date()): Promise<FiringReport[]> {
  const out = await withSweepLock(() => sweepOnce(now));
  return out ?? [];
}

export function startScheduler(everySeconds = Number(process.env.SCHEDULER_INTERVAL_SECONDS || 30)) {
  const expr = everySeconds < 60 ? `*/${everySeconds} * * * * *` : `*/${Math.floor(everySeconds / 60)} * * * *`;
  log.info('scheduler started', { event: 'scheduler_start', interval_seconds: everySeconds });
  return cron.schedule(expr, () => { void sweepIfLeader(); });
}
