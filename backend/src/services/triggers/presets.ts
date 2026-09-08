// src/services/triggers/presets.ts
//
// Ready-made triggers. The client offers these during onboarding so a user never
// has to hand-write condition JSON. Each preset takes a few params and returns
// a TriggerCreate.
import { z } from 'zod';
import { TriggerCreate, TriggerCreateT } from '../../types/trigger/Trigger.js';
import { Result } from '../../types/common/common.js';

export interface TriggerPreset<P extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  name: string;
  description: string;
  kind: TriggerCreateT['kind'];
  params: Record<string, string>;   // human-readable param docs
  schema: P;
  build: (p: z.infer<P>) => TriggerCreateT;
}

function preset<P extends z.ZodTypeAny>(p: TriggerPreset<P>): TriggerPreset<P> { return p; }

export const TRIGGER_PRESETS = [
  preset({
    id: 'doomscroll',
    name: 'Doomscroll check',
    description: 'After N minutes on a distracting app in the last hour, one nudge. Respects budget and quiet hours.',
    kind: 'app_usage',
    params: { minutes: 'minutes before nudging (default 30)', bundle_ids: 'optional list; default = apps labeled distracting', cooldown_minutes: 'default 60' },
    schema: z.object({ minutes: z.number().positive().default(30), bundle_ids: z.array(z.string()).default([]), cooldown_minutes: z.number().int().min(0).default(60) }),
    build: p => ({
      kind: 'app_usage',
      name: `${p.minutes} min on ${p.bundle_ids.length ? p.bundle_ids.join(', ') : 'distracting apps'}`,
      enabled: true,
      match: { bundle_ids: p.bundle_ids, min_minutes: p.bundle_ids.length ? p.minutes : 0, window_minutes: 60 },
      condition: p.bundle_ids.length
        ? { type: 'all', params: { conditions: [{ type: 'outside_quiet_hours', params: {} }, { type: 'interrupt_budget_remaining', params: {} }] } }
        : { type: 'all', params: { conditions: [
            { type: 'app_usage_minutes', params: { label: 'distracting', window_minutes: 60, operator: '>=', minutes: p.minutes } },
            { type: 'outside_quiet_hours', params: {} },
            { type: 'interrupt_budget_remaining', params: {} },
          ] } },
      actions: [{ action: 'notify_user', params: {
        message: "{{minutes}} min on {{app}}. you good?",
        messages: ["still on {{app}}. {{minutes}} min now.", "ok. {{minutes}} min on {{app}}. i'll stop counting out loud.", "{{app}}, {{minutes}} min. your call."],
        voice: true,
      } }],
      cooldown_seconds: p.cooldown_minutes * 60,
      source: 'preset:doomscroll',
    }),
  }),
  preset({
    id: 'deadline_drift',
    name: 'Deadline drift',
    description: 'Scrolling while something is due soon. The core Jiko moment.',
    kind: 'app_usage',
    params: { minutes: 'minutes on distracting apps (default 20)', hours_before: 'how close a deadline must be (default 24)' },
    schema: z.object({ minutes: z.number().positive().default(20), hours_before: z.number().positive().default(24) }),
    build: p => ({
      kind: 'app_usage',
      name: 'Deadline drift',
      enabled: true,
      match: { bundle_ids: [], min_minutes: 0, window_minutes: 60 },
      condition: { type: 'all', params: { conditions: [
        { type: 'app_usage_minutes', params: { label: 'distracting', window_minutes: 60, operator: '>=', minutes: p.minutes } },
        { type: 'obligation_due_within', params: { hours: p.hours_before } },
        { type: 'outside_quiet_hours', params: {} },
      ] } },
      actions: [{ action: 'notify_user', params: {
        message: "{{minutes}} min on {{app}} and {{obligation}} is due {{obligation_due}}. plan?",
        messages: ["{{obligation}} is due {{obligation_due}}. {{app}} again.", "not going to say it a third time. {{obligation}}, {{obligation_due}}."],
        voice: true,
        urgent: true,
      } }],
      cooldown_seconds: 45 * 60,
      source: 'preset:deadline_drift',
    }),
  }),
  preset({
    id: 'late_night',
    name: 'Late night',
    description: 'Phone use past a certain hour.',
    kind: 'app_usage',
    params: { after: 'HH:MM local (default 01:00)', until: 'HH:MM local (default 05:00)' },
    schema: z.object({ after: z.string().regex(/^\d{2}:\d{2}$/).default('01:00'), until: z.string().regex(/^\d{2}:\d{2}$/).default('05:00') }),
    build: p => ({
      kind: 'app_usage',
      name: `Up past ${p.after}`,
      enabled: true,
      match: { bundle_ids: [], min_minutes: 5, window_minutes: 30 },
      condition: { type: 'time_range', params: { start: p.after, end: p.until } },
      actions: [{ action: 'notify_user', params: { message: 'go to sleep.', voice: true, urgent: true } }],
      cooldown_seconds: 90 * 60,
      source: 'preset:late_night',
    }),
  }),
  preset({
    id: 'arrive',
    name: 'Arrived somewhere',
    description: 'Start an activity when you enter a place (gym, library).',
    kind: 'location',
    params: { location_id: 'uuid of a saved location', activity_id: 'uuid of the activity to start', message: 'optional nudge text' },
    schema: z.object({ location_id: z.uuid(), activity_id: z.uuid(), message: z.string().optional() }),
    build: p => ({
      kind: 'location',
      name: 'Arrived',
      enabled: true,
      match: { location_id: p.location_id, event: 'enter' },
      condition: true,
      actions: [
        { action: 'start_activity', params: { activity_id: p.activity_id } },
        ...(p.message ? [{ action: 'notify_user' as const, params: { message: p.message } }] : []),
      ],
      cooldown_seconds: 10 * 60,
      source: 'preset:arrive',
    }),
  }),
  preset({
    id: 'leave',
    name: 'Left somewhere',
    description: 'Stop an activity when you leave a place.',
    kind: 'location',
    params: { location_id: 'uuid of a saved location', activity_id: 'uuid of the activity to stop' },
    schema: z.object({ location_id: z.uuid(), activity_id: z.uuid() }),
    build: p => ({
      kind: 'location',
      name: 'Left',
      enabled: true,
      match: { location_id: p.location_id, event: 'exit' },
      condition: true,
      actions: [{ action: 'stop_activity', params: { activity_id: p.activity_id } }],
      cooldown_seconds: 10 * 60,
      source: 'preset:leave',
    }),
  }),
  preset({
    id: 'nightly_summary',
    name: 'Nightly summary',
    description: 'One line at the end of the day. Never counts against your budget.',
    kind: 'scheduled',
    params: { at: 'ISO datetime of the first run (default: tonight 21:30 UTC)' },
    schema: z.object({ at: z.iso.datetime().optional() }),
    build: p => {
      const at = p.at ?? (() => { const d = new Date(); d.setUTCHours(21, 30, 0, 0); if (d < new Date()) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString(); })();
      return {
        kind: 'scheduled',
        name: 'Nightly summary',
        enabled: true,
        match: { at, recurrence: { interval: 1, unit: 'days' } },
        condition: true,
        actions: [{ action: 'daily_summary', params: { days_ago: 0 } }],
        cooldown_seconds: 0,
        source: 'preset:nightly_summary',
      };
    },
  }),
  preset({
    id: 'deadline_reminder',
    name: 'Deadline reminder',
    description: 'A heads-up when a task is due within N hours, once per task.',
    kind: 'obligation',
    params: { hours_before: 'default 12' },
    schema: z.object({ hours_before: z.number().positive().default(12) }),
    build: p => ({
      kind: 'obligation',
      name: `Due within ${p.hours_before}h`,
      enabled: true,
      match: { kind: 'task', hours_before: p.hours_before },
      condition: { type: 'outside_quiet_hours', params: {} },
      actions: [{ action: 'notify_user', params: { message: '{{obligation}} is due {{obligation_due}}.', voice: true } }],
      cooldown_seconds: 0,
      source: 'preset:deadline_reminder',
    }),
  }),
  preset({
    id: 'morning_checkin',
    name: 'Morning check-in',
    description: 'One message in the morning with what is due.',
    kind: 'scheduled',
    params: { at: 'ISO datetime of the first run (default: tomorrow 08:30 UTC)' },
    schema: z.object({ at: z.iso.datetime().optional() }),
    build: p => {
      const at = p.at ?? (() => { const d = new Date(); d.setUTCHours(8, 30, 0, 0); if (d < new Date()) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString(); })();
      return {
        kind: 'scheduled',
        name: 'Morning check-in',
        enabled: true,
        match: { at, recurrence: { interval: 1, unit: 'days' } },
        condition: { type: 'obligation_due_within', params: { hours: 36 } },
        actions: [{ action: 'notify_user', params: { message: 'morning. {{obligation}} is due {{obligation_due}}. plan?', voice: true } }],
        cooldown_seconds: 0,
        source: 'preset:morning_checkin',
      };
    },
  }),
];

export function instantiatePreset(preset: TriggerPreset, params: unknown): Result<TriggerCreateT> {
  const p = preset.schema.safeParse(params);
  if (!p.success) return { success: false, code: 400, details: { error: 'InvalidBody', message: p.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') } };
  const built = TriggerCreate.safeParse(preset.build(p.data));
  if (!built.success) return { success: false, code: 500, details: { error: 'PresetError', message: built.error.issues.map(i => i.message).join('; ') } };
  return { success: true, value: built.data };
}
