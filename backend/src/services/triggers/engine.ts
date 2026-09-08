// src/services/triggers/engine.ts
//
// One entry point: runTriggers(user_id, event). For every enabled trigger of
// the event's kind: match -> cooldown -> condition -> execute -> record.
import TriggerRepository from '../repositories/TriggerRepository.js';
import LocationRepository from '../repositories/LocationRepository.js';
import { TriggerT } from '../../types/trigger/Trigger.js';
import { ActionResultT } from '../../types/json/Action.js';
import { SyncEvent, TriggerContext, buildContext, usageWindow } from './context.js';
import { evaluateCondition } from './condition.js';
import { executeActions } from './execute.js';
import { nextRun } from './schedule.js';

export interface FiringReport {
  trigger_id: string;
  name: string;
  results: ActionResultT[];
}

export interface RunOptions {
  now?: Date;
  appUsage?: Parameters<typeof buildContext>[2] extends infer O ? (O extends { appUsage?: infer A } ? A : never) : never;
  health?: Parameters<typeof buildContext>[2] extends infer O ? (O extends { health?: infer H } ? H : never) : never;
  lastLocation?: Parameters<typeof buildContext>[2] extends infer O ? (O extends { lastLocation?: infer L } ? L : never) : never;
}

export async function runTriggers(user_id: string, event: SyncEvent, opts: RunOptions = {}): Promise<FiringReport[]> {
  const kind = event.kind === 'manual' ? null : event.kind;
  const triggers = kind ? await TriggerRepository.listEnabled(user_id, kind) : [];
  if (triggers.length === 0) return [];
  const ctx = await buildContext(user_id, event, opts);
  const reports: FiringReport[] = [];
  for (const trigger of triggers) {
    try {
      const report = await runOne(trigger, ctx);
      if (report) reports.push(report);
    } catch (err) {
      console.error(`[engine] trigger ${trigger.id} (${trigger.name}) failed:`, err);
    }
  }
  return reports;
}

/** Evaluate and (if it passes) fire a single trigger. Exported for the scheduler. */
export async function runOne(trigger: TriggerT, ctx: TriggerContext): Promise<FiringReport | null> {
  ctx.trigger = trigger;
  ctx.matched = {};

  if (!(await matches(trigger, ctx))) return null;
  if (!cooldownExpired(trigger, ctx.now)) return null;
  if (!(await evaluateCondition(trigger.condition, ctx))) return null;

  const results = await executeActions(trigger.actions, ctx);
  const next = trigger.kind === 'scheduled' ? nextRun(trigger.match, ctx.now) : undefined;
  await TriggerRepository.recordFiring(trigger.id, ctx.user_id, {
    event: ctx.event.kind,
    matched: {
      app: ctx.matched.app,
      location: ctx.matched.location,
      obligation_id: ctx.matched.obligation?.id,
      obligation_title: ctx.matched.obligation?.title,
      metric: ctx.matched.metric,
    },
  }, results, trigger.kind === 'scheduled' ? next : undefined);
  return { trigger_id: trigger.id, name: trigger.name, results };
}

function cooldownExpired(trigger: TriggerT, now: Date): boolean {
  if (!trigger.cooldown_seconds && !trigger.last_fired_at) return true;
  const last = trigger.last_fired_at ? new Date(trigger.last_fired_at).getTime() : 0;
  // A snooze sets last_fired_at in the future; that also blocks firing.
  if (last > now.getTime()) return false;
  return now.getTime() - last >= trigger.cooldown_seconds * 1000;
}

async function matches(trigger: TriggerT, ctx: TriggerContext): Promise<boolean> {
  const ev = ctx.event;
  switch (trigger.kind) {
    case 'app_usage': {
      if (ev.kind !== 'app_usage') return false;
      const m = trigger.match;
      const wanted = new Set(m.bundle_ids);
      const inPayload = new Set(ev.data.log.map(l => l.bundleId));
      const candidates = wanted.size ? [...wanted].filter(b => inPayload.has(b)) : [...inPayload];
      if (candidates.length === 0) return false;
      const win = usageWindow(ctx.appLogs(), ctx.now, m.window_minutes);
      let best: { bundle_id: string; app_name: string; minutes: number } | null = null;
      for (const b of candidates) {
        const w = win.get(b);
        const minutes = (w?.seconds ?? 0) / 60;
        if (minutes >= m.min_minutes && (!best || minutes > best.minutes)) {
          best = { bundle_id: b, app_name: w?.app_name ?? ev.data.log.find(l => l.bundleId === b)?.appName ?? b, minutes };
        }
      }
      if (!best) return false;
      ctx.matched.app = best;
      return true;
    }
    case 'location': {
      if (ev.kind !== 'location') return false;
      const m = trigger.match;
      const nowInside = (await ctx.locationsContaining(ev.current.latitude, ev.current.longitude)).includes(m.location_id);
      const wasInside = ev.previous ? (await ctx.locationsContaining(ev.previous.latitude, ev.previous.longitude)).includes(m.location_id) : false;
      let fired: 'enter' | 'exit' | null = null;
      if (nowInside && !wasInside && (m.event === 'enter' || m.event === 'both')) fired = 'enter';
      if (!nowInside && wasInside && (m.event === 'exit' || m.event === 'both')) fired = 'exit';
      if (!fired) return false;
      const loc = await LocationRepository.get(m.location_id, ctx.user_id);
      ctx.matched.location = { id: m.location_id, name: loc.success ? loc.value.name : 'somewhere', event: fired };
      return true;
    }
    case 'scheduled': {
      if (ev.kind !== 'scheduled') return false;
      return Boolean(trigger.next_run_at && new Date(trigger.next_run_at).getTime() <= ctx.now.getTime());
    }
    case 'health': {
      if (ev.kind !== 'health') return false;
      const v = ctx.healthMetric(trigger.match.metric, 24);
      if (v === null) return false;
      ctx.matched.metric = { name: trigger.match.metric, value: v };
      return true;
    }
    case 'obligation': {
      if (ev.kind !== 'obligation') return false;
      const o = ev.obligation;
      if (trigger.match.kind && o.kind !== trigger.match.kind) return false;
      const at = (o.due_at ?? o.start_at) as Date | null | undefined;
      if (!at) return false;
      const hoursLeft = (new Date(at).getTime() - ctx.now.getTime()) / 3600_000;
      if (hoursLeft > trigger.match.hours_before || hoursLeft < -1) return false;
      ctx.matched.obligation = o;
      return true;
    }
    default:
      return false;
  }
}
