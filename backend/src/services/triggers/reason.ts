// src/services/triggers/reason.ts
//
// "why did I get this?" in one line. Built from the matched context a firing
// records, so the answer is what actually fired, not a guess after the fact.
import { humanizeDelta } from './time.js';

export interface FiringContext {
  event?: string;
  reason?: string;
  matched?: {
    app?: { bundle_id?: string; app_name?: string; minutes?: number };
    location?: { id?: string; name?: string; event?: string };
    obligation_id?: string;
    obligation_title?: string;
    obligation_due?: string;
    metric?: { name?: string; value?: number };
    goal?: { title?: string; logged_minutes?: number; target_minutes?: number; percent?: number };
  };
}

function minutes(n: number): string {
  const m = Math.round(n);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/**
 * A sentence a person can argue with. Parts are joined with ", and " so the
 * line reads as the conjunction the condition actually was.
 */
export function describeFiring(ctx: FiringContext, now = new Date()): string {
  const m = ctx.matched ?? {};
  const parts: string[] = [];

  if (m.app) {
    const name = m.app.app_name ?? m.app.bundle_id ?? 'an app';
    parts.push(m.app.minutes !== undefined ? `${minutes(m.app.minutes)} on ${name}` : `you opened ${name}`);
  }
  if (m.location?.name) {
    parts.push(`${m.location.event === 'exit' ? 'you left' : 'you arrived at'} ${m.location.name}`);
  }
  if (m.obligation_title) {
    const due = m.obligation_due ? ` (due ${humanizeDelta(now, new Date(m.obligation_due))})` : '';
    parts.push(`${m.obligation_title} is open${due}`);
  }
  if (m.goal?.title) {
    const logged = m.goal.logged_minutes !== undefined ? minutes(m.goal.logged_minutes) : '?';
    const target = m.goal.target_minutes !== undefined ? minutes(m.goal.target_minutes) : '?';
    parts.push(`${m.goal.title}: ${logged} of ${target}`);
  }
  if (m.metric?.name) {
    parts.push(`${m.metric.name} was ${m.metric.value}`);
  }

  if (parts.length === 0) {
    if (ctx.event === 'scheduled') return 'it was the scheduled time.';
    if (ctx.event === 'obligation') return 'something was coming due.';
    return 'the rule matched.';
  }
  return parts.join(', and ') + '.';
}
