// src/services/triggers/scheduler.ts
//
// Periodic sweep for triggers that aren't woken by a device sync:
//   - scheduled: next_run_at <= now
//   - obligation: something is due within the trigger's hours_before window
// Started from index.ts when ENABLE_SCHEDULER=true.
import cron from 'node-cron';
import TriggerRepository from '../repositories/TriggerRepository.js';
import ObligationRepository from '../repositories/ObligationRepository.js';
import { buildContext } from './context.js';
import { runOne, FiringReport } from './engine.js';
import AppUsageManager from '../../data/AppUsageManager.js';
import HealthManager from '../../data/HealthManager.js';
import LocationManager from '../../data/LocationManager.js';
import { query } from '../../db/psqlClient.js';

let running = false;

export async function sweepOnce(now = new Date()): Promise<FiringReport[]> {
  if (running) return [];
  running = true;
  const reports: FiringReport[] = [];
  try {
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
    console.error('[scheduler] sweep failed:', err);
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

export function startScheduler(everySeconds = Number(process.env.SCHEDULER_INTERVAL_SECONDS || 30)) {
  const expr = everySeconds < 60 ? `*/${everySeconds} * * * * *` : `*/${Math.floor(everySeconds / 60)} * * * *`;
  console.log(`[scheduler] sweeping every ${everySeconds}s`);
  return cron.schedule(expr, () => { void sweepOnce(); });
}
