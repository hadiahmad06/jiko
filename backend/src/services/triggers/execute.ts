// src/services/triggers/execute.ts
//
// Executes a trigger's actions in order. Each action returns an ActionResult;
// nothing throws past this module.
import crypto from 'crypto';
import { Action, ActionListT, ActionResultT, ActionT } from '../../types/json/Action.js';
import { TriggerContext } from './context.js';
import ActivityRepository from '../ActivityRepository.js';
import ObligationRepository from '../repositories/ObligationRepository.js';
import PreferencesRepository from '../repositories/PreferencesRepository.js';
import TriggerRepository from '../repositories/TriggerRepository.js';
import { sendMessage } from '../messaging/outbox.js';
import { renderTemplate } from '../messaging/template.js';
import { humanizeDelta } from './time.js';
import { buildDailySummary, formatDailySummary } from '../summary.js';
import { voiceRewrite } from '../messaging/voice.js';
import MessageRepository from '../repositories/MessageRepository.js';

/**
 * Values a message template can interpolate. `template` is the text about to
 * be rendered; it decides whether the lookups only some templates need (the
 * weekly reflection) are worth a query.
 */
export async function templateVars(ctx: TriggerContext, template = ''): Promise<Record<string, string | number | undefined>> {
  const m = ctx.matched;
  const due = m.obligation ?? (await ctx.obligationsDueWithin(48))[0];
  // Last week's answer, so monday can refer to what sunday said.
  const reflection = /\{\{\s*reflection\s*\}\}/.test(template)
    ? await MessageRepository.lastOfKind(ctx.user_id, 'reflection', 9)
    : null;
  return {
    name: await ctx.userName(),
    app: m.app?.app_name,
    minutes: m.app ? Math.round(m.app.minutes) : undefined,
    location: m.location?.name,
    obligation: due?.title,
    obligation_due: due ? humanizeDelta(ctx.now, new Date((due.due_at ?? due.start_at) as Date)) : undefined,
    metric: m.metric?.name,
    metric_value: m.metric?.value,
    goal: m.goal?.title,
    goal_target: m.goal ? humanMinutes(m.goal.target_minutes) : undefined,
    goal_logged: m.goal ? humanMinutes(m.goal.logged_minutes) : undefined,
    goal_remaining: m.goal ? humanMinutes(m.goal.remaining_minutes) : undefined,
    goal_percent: m.goal?.percent,
    goal_days: m.goal?.timeframe_days,
    weekday: ctx.now.toLocaleDateString('en-US', { weekday: 'long', timeZone: ctx.prefs.timezone }).toLowerCase(),
    reflection: reflection?.body,
  };
}

/** "40 min", "3h", "1h 30m" - the way a person would text it. */
export function humanMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export async function executeActions(actions: ActionListT, ctx: TriggerContext): Promise<ActionResultT[]> {
  const results: ActionResultT[] = [];
  for (const raw of actions) {
    const parsed = Action.safeParse(raw);
    if (!parsed.success) {
      results.push({ action: String((raw as { action?: string })?.action ?? '?'), ok: false, detail: 'invalid action: ' + parsed.error.issues.map(i => i.message).join('; ') });
      continue;
    }
    try {
      results.push(await executeAction(parsed.data, ctx));
    } catch (err) {
      results.push({ action: parsed.data.action, ok: false, detail: (err as Error).message });
    }
  }
  return results;
}

export async function executeAction(action: ActionT, ctx: TriggerContext): Promise<ActionResultT> {
  const user_id = ctx.user_id;
  switch (action.action) {
    case 'notify_user': {
      const variants = [action.params.message, ...(action.params.messages ?? [])];
      const template = variants[(ctx.trigger?.fire_count ?? 0) % variants.length]!;
      let body = renderTemplate(template, await templateVars(ctx, template));
      if (action.params.voice) body = await voiceRewrite(body, ctx);
      const r = await sendMessage({
        user_id,
        body,
        trigger_id: ctx.trigger?.id ?? null,
        urgent: action.params.urgent ?? false,
        now: ctx.now,
        ...(action.params.counts_as_interrupt !== undefined ? { counts_as_interrupt: action.params.counts_as_interrupt } : {}),
        ...(action.params.tag ? { metadata: { tag: action.params.tag } } : {}),
      });
      return r.sent
        ? { action: 'notify_user', ok: true, ref: r.message.id, detail: r.message.status }
        : { action: 'notify_user', ok: false, detail: r.reason };
    }
    case 'start_activity': {
      const open = await ActivityRepository.openEntries(user_id);
      if (open.some(e => e.activity_id === action.params.activity_id)) return { action: 'start_activity', ok: true, detail: 'already in progress' };
      const r = await ActivityRepository.addEntry({
        id: crypto.randomUUID(),
        user_id,
        activity_id: action.params.activity_id,
        start_time: ctx.now,
        logged_by: 'trigger',
        ...(action.params.note ? { note: action.params.note } : {}),
      });
      return r.success ? { action: 'start_activity', ok: true, ref: r.value.id } : { action: 'start_activity', ok: false, detail: r.details.message };
    }
    case 'stop_activity': {
      const r = await ActivityRepository.closeOpenEntry(user_id, action.params.activity_id, ctx.now, 'trigger', action.params.note);
      return r ? { action: 'stop_activity', ok: true, ref: r.id } : { action: 'stop_activity', ok: false, detail: 'no open entry' };
    }
    case 'complete_obligation': {
      const r = await ObligationRepository.update(action.params.obligation_id, user_id, { completed: true });
      return r.success ? { action: 'complete_obligation', ok: true, ref: r.value.id } : { action: 'complete_obligation', ok: false, detail: r.details.message };
    }
    case 'create_obligation': {
      const due = action.params.due_in_minutes ? new Date(ctx.now.getTime() + action.params.due_in_minutes * 60_000) : undefined;
      const r = await ObligationRepository.create(user_id, {
        kind: action.params.kind,
        title: action.params.title,
        source: 'trigger',
        ...(action.params.kind === 'task' ? { due_at: due ?? new Date(ctx.now.getTime() + 24 * 3600_000) } : {}),
        ...(action.params.kind === 'event' ? { start_at: due ?? ctx.now } : {}),
        ...(action.params.kind === 'goal' ? { target_minutes: 30, timeframe_days: 1 } : {}),
      });
      return r.success ? { action: 'create_obligation', ok: true, ref: r.value.id } : { action: 'create_obligation', ok: false, detail: r.details.message };
    }
    case 'set_preference': {
      await PreferencesRepository.update(user_id, { [action.params.key]: action.params.value } as never);
      return { action: 'set_preference', ok: true };
    }
    case 'enable_trigger':
    case 'disable_trigger': {
      const r = await TriggerRepository.update(action.params.trigger_id, user_id, { enabled: action.action === 'enable_trigger' });
      return r.success ? { action: action.action, ok: true, ref: r.value.id } : { action: action.action, ok: false, detail: r.details.message };
    }
    case 'snooze_trigger': {
      const id = action.params.trigger_id ?? ctx.trigger?.id;
      if (!id) return { action: 'snooze_trigger', ok: false, detail: 'no trigger to snooze' };
      // A snooze is a temporary cooldown: push last_fired_at forward so cooldown math covers the window.
      const until = new Date(ctx.now.getTime() + action.params.minutes * 60_000);
      const r = await TriggerRepository.update(id, user_id, { next_run_at: until, last_fired_at: until });
      return r.success ? { action: 'snooze_trigger', ok: true, ref: id, detail: `until ${until.toISOString()}` } : { action: 'snooze_trigger', ok: false, detail: r.details.message };
    }
    case 'daily_summary': {
      const summary = await buildDailySummary(user_id, action.params.days_ago, ctx.now);
      const body = formatDailySummary(summary, ctx.prefs.strictness);
      const r = await sendMessage({ user_id, body, trigger_id: ctx.trigger?.id ?? null, counts_as_interrupt: false, now: ctx.now, metadata: { kind: 'daily_summary', day: summary.day } });
      return r.sent ? { action: 'daily_summary', ok: true, ref: r.message.id } : { action: 'daily_summary', ok: false, detail: r.reason };
    }
    case 'log': {
      console.log(`[trigger ${ctx.trigger?.name ?? '?'} user ${user_id}] ${renderTemplate(action.params.message, await templateVars(ctx, action.params.message))}`);
      return { action: 'log', ok: true };
    }
    default:
      return { action: (action as { action: string }).action, ok: false, detail: 'unknown action' };
  }
}
