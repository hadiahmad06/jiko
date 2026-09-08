// src/services/triggers/condition.ts
//
// Evaluates a Condition against a TriggerContext. Unknown condition types are
// false: a system whose job is not to spam people fails closed.
import { ConditionT } from '../../types/json/Condition.js';
import { TriggerContext, usageWindow } from './context.js';
import { inRange, localHHMM, localWeekday, startOfLocalDay } from './time.js';
import TriggerRepository from '../repositories/TriggerRepository.js';
import MessageRepository from '../repositories/MessageRepository.js';

function cmp(op: string, a: number, b: number): boolean {
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    case '==': return a === b;
    default: return false;
  }
}

export async function evaluateCondition(c: ConditionT, ctx: TriggerContext): Promise<boolean> {
  if (typeof c === 'boolean') return c;
  const tz = ctx.prefs.timezone;

  switch (c.type) {
    // --- combinators
    case 'all': {
      for (const sub of c.params.conditions) if (!(await evaluateCondition(sub, ctx))) return false;
      return true;
    }
    case 'any': {
      for (const sub of c.params.conditions) if (await evaluateCondition(sub, ctx)) return true;
      return false;
    }
    case 'none': {
      for (const sub of c.params.conditions) if (await evaluateCondition(sub, ctx)) return false;
      return true;
    }
    case 'at_least_n': {
      let n = 0;
      for (const sub of c.params.conditions) {
        if (await evaluateCondition(sub, ctx)) { n++; if (n >= c.params.n) return true; }
      }
      return n >= c.params.n;
    }

    // --- time
    case 'time_range':
      return inRange(localHHMM(ctx.now, c.params.timezone ?? tz), c.params.start, c.params.end);
    case 'weekday': {
      const today = localWeekday(ctx.now, c.params.timezone ?? tz);
      return Array.isArray(c.params.days) ? c.params.days.includes(today as never) : c.params.days === today;
    }
    case 'outside_quiet_hours': {
      const q = ctx.prefs.quiet_hours;
      return !inRange(localHHMM(ctx.now, tz), q.start, q.end);
    }

    // --- app usage
    case 'app_usage_minutes': {
      const win = usageWindow(ctx.appLogs(), ctx.now, c.params.window_minutes);
      let seconds = 0;
      if (c.params.bundle_id) {
        seconds = win.get(c.params.bundle_id)?.seconds ?? 0;
      } else if (c.params.label) {
        const labels = await ctx.labels();
        for (const [bundle, v] of win) if (labels[bundle] === c.params.label) seconds += v.seconds;
      } else {
        for (const v of win.values()) seconds += v.seconds;
      }
      return cmp(c.params.operator, seconds / 60, c.params.minutes);
    }
    case 'app_recently_used': {
      const cutoff = ctx.now.getTime() - c.params.within_seconds * 1000;
      return ctx.appLogs().some(l => l.bundleId === c.params.bundle_id
        && (!c.params.device_id || true)
        && new Date(l.startTime || l.timestamp).getTime() + Math.max(0, l.durationSeconds) * 1000 >= cutoff);
    }
    case 'app_not_running': {
      const cutoff = ctx.now.getTime() - c.params.min_seconds_not_running * 1000;
      return !ctx.appLogs().some(l => l.bundleId === c.params.bundle_id
        && new Date(l.startTime || l.timestamp).getTime() + Math.max(0, l.durationSeconds) * 1000 >= cutoff);
    }
    case 'no_foreground_activity': {
      const cutoff = ctx.now.getTime() - c.params.duration_minutes * 60_000;
      return !ctx.appLogs().some(l => l.isForeground !== false
        && new Date(l.startTime || l.timestamp).getTime() + Math.max(0, l.durationSeconds) * 1000 >= cutoff);
    }

    // --- obligations
    case 'obligation_due_within': {
      const due = await ctx.obligationsDueWithin(c.params.hours, c.params.kind, c.params.min_intervention_level ?? 0);
      if (due[0] && !ctx.matched.obligation) ctx.matched.obligation = due[0];
      return due.length > 0;
    }
    case 'no_obligation_due_within':
      return (await ctx.obligationsDueWithin(c.params.hours)).length === 0;

    // --- activities
    case 'activity_in_progress': {
      const open = await ctx.openActivityEntries();
      return c.params.activity_id ? open.some(e => e.activity_id === c.params.activity_id) : open.length > 0;
    }
    case 'no_activity_in_progress':
      return (await ctx.openActivityEntries()).length === 0;

    // --- location
    case 'inside_location':
    case 'outside_location': {
      const loc = ctx.currentLocation();
      if (!loc) return c.type === 'outside_location'; // unknown position counts as outside
      const inside = (await ctx.locationsContaining(loc.latitude, loc.longitude)).includes(c.params.location_id);
      return c.type === 'inside_location' ? inside : !inside;
    }

    // --- health
    case 'health_metric': {
      const v = ctx.healthMetric(c.params.metric, c.params.window_hours);
      if (v === null) return false;
      return cmp(c.params.operator, v, c.params.value);
    }

    // --- rate limiting
    case 'cooldown_expired': {
      if (!ctx.trigger) return true;
      const last = ctx.trigger.last_fired_at ? new Date(ctx.trigger.last_fired_at).getTime() : 0;
      return ctx.now.getTime() - last >= c.params.cooldown_seconds * 1000;
    }
    case 'quota_remaining': {
      if (!ctx.trigger) return true;
      const n = await TriggerRepository.firingsSince(ctx.trigger.id, startOfLocalDay(ctx.now, tz));
      return n < c.params.max_daily;
    }
    case 'interrupt_budget_remaining': {
      const n = await MessageRepository.interruptsSince(ctx.user_id, startOfLocalDay(ctx.now, tz));
      return n < ctx.prefs.interrupt_budget_per_day;
    }

    default: {
      console.warn(`[condition] unknown type ${(c as { type?: string }).type}; evaluating to false`);
      return false;
    }
  }
}
