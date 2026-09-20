import { describe, it, expect, vi } from 'vitest';
import { evaluateCondition } from '../../../services/triggers/condition.js';
import { TriggerContext } from '../../../services/triggers/context.js';
import { UserPreferences } from '../../../types/user/UserPreferences.js';

vi.mock('../../../services/repositories/TriggerRepository.js', () => ({ default: { firingsSince: vi.fn().mockResolvedValue(0) } }));
vi.mock('../../../services/repositories/MessageRepository.js', () => ({ default: { interruptsSince: vi.fn().mockResolvedValue(2) } }));

const NOW = new Date('2026-09-08T15:30:00Z'); // Tuesday
const log = (bundleId: string, minutes: number, endMinutesAgo = 0, fg = true) => {
  const end = new Date(NOW.getTime() - endMinutesAgo * 60_000);
  return { bundleId, appName: bundleId, timestamp: end.toISOString(), startTime: new Date(end.getTime() - minutes * 60_000).toISOString(), durationSeconds: minutes * 60, isForeground: fg };
};

function ctx(over: Partial<TriggerContext> = {}, prefs: Partial<ReturnType<typeof UserPreferences.parse>> = {}): TriggerContext {
  return {
    user_id: 'u', now: NOW, event: { kind: 'manual' }, matched: {},
    prefs: UserPreferences.parse({ user_id: '11111111-1111-4111-8111-111111111111', timezone: 'UTC', interrupt_budget_per_day: 4, ...prefs }),
    appLogs: () => [],
    labels: async () => ({}),
    obligationsDueWithin: async () => [],
    locationsContaining: async () => [],
    currentLocation: () => null,
    openActivityEntries: async () => [],
    healthMetric: () => null,
    userName: async () => 'you',
    ...over,
  } as TriggerContext;
}

const goal = (over: Record<string, unknown> = {}) => ({
  id: '22222222-2222-4222-8222-222222222222',
  user_id: 'u',
  kind: 'goal',
  title: 'reading',
  activity_id: '33333333-3333-4333-8333-333333333333',
  target_minutes: 180,
  timeframe_days: 7,
  created_at: new Date('2026-09-01T00:00:00Z'),
  ...over,
} as never);

const progress = (over: Record<string, unknown> = {}) => ({
  goal_id: '22222222-2222-4222-8222-222222222222',
  title: 'reading',
  activity_id: '33333333-3333-4333-8333-333333333333',
  target_minutes: 180,
  logged_minutes: 40,
  remaining_minutes: 140,
  percent: 22,
  timeframe_days: 7,
  elapsed_fraction: 0.6,
  window_start: new Date('2026-09-01T15:30:00Z'),
  ...over,
} as never);

describe('goal_progress', () => {
  it('fires when logged minutes are under the target percentage', async () => {
    const c = ctx({ openGoals: async () => [goal()], goalProgress: async () => progress() });
    expect(await evaluateCondition({ type: 'goal_progress', params: { operator: '<', percent: 60, min_elapsed_fraction: 0 } }, c)).toBe(true);
    expect(c.matched.goal?.logged_minutes).toBe(40);
  });

  it('stays quiet when the goal is on pace', async () => {
    const c = ctx({ openGoals: async () => [goal()], goalProgress: async () => progress({ logged_minutes: 150, percent: 83 }) });
    expect(await evaluateCondition({ type: 'goal_progress', params: { operator: '<', percent: 60, min_elapsed_fraction: 0 } }, c)).toBe(false);
  });

  it('stays quiet early in the window', async () => {
    const c = ctx({ openGoals: async () => [goal()], goalProgress: async () => progress({ elapsed_fraction: 0.1 }) });
    expect(await evaluateCondition({ type: 'goal_progress', params: { operator: '<', percent: 60, min_elapsed_fraction: 0.4 } }, c)).toBe(false);
  });

  it('ignores goals that cannot be measured', async () => {
    const c = ctx({ openGoals: async () => [goal({ activity_id: null })], goalProgress: async () => null });
    expect(await evaluateCondition({ type: 'goal_progress', params: { operator: '<', percent: 60, min_elapsed_fraction: 0 } }, c)).toBe(false);
    expect(c.matched.goal).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  it('booleans and combinators', async () => {
    const c = ctx();
    expect(await evaluateCondition(true, c)).toBe(true);
    expect(await evaluateCondition({ type: 'all', params: { conditions: [true, false] } }, c)).toBe(false);
    expect(await evaluateCondition({ type: 'any', params: { conditions: [false, true] } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'none', params: { conditions: [false] } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'at_least_n', params: { n: 2, conditions: [true, true, false] } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'at_least_n', params: { n: 3, conditions: [true, true, false] } }, c)).toBe(false);
  });

  it('unknown types fail closed', async () => {
    expect(await evaluateCondition({ type: 'wat', params: {} } as never, ctx())).toBe(false);
  });

  it('time_range honours timezone and wraps midnight', async () => {
    const c = ctx();
    expect(await evaluateCondition({ type: 'time_range', params: { start: '15:00', end: '16:00' } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'time_range', params: { start: '16:00', end: '17:00' } }, c)).toBe(false);
    // 15:30Z = 10:30 in Chicago (CDT)
    expect(await evaluateCondition({ type: 'time_range', params: { start: '10:00', end: '11:00', timezone: 'America/Chicago' } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'time_range', params: { start: '23:00', end: '16:00' } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'time_range', params: { start: '23:00', end: '15:00' } }, c)).toBe(false);
  });

  it('weekday', async () => {
    const c = ctx();
    expect(await evaluateCondition({ type: 'weekday', params: { days: 'tuesday' } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'weekday', params: { days: ['saturday', 'sunday'] } }, c)).toBe(false);
  });

  it('outside_quiet_hours', async () => {
    expect(await evaluateCondition({ type: 'outside_quiet_hours', params: {} }, ctx({}, { quiet_hours: { start: '23:00', end: '08:00' } }))).toBe(true);
    expect(await evaluateCondition({ type: 'outside_quiet_hours', params: {} }, ctx({}, { quiet_hours: { start: '15:00', end: '16:00' } }))).toBe(false);
  });

  it('app_usage_minutes by bundle, by label, and clipped to the window', async () => {
    const c = ctx({ appLogs: () => [log('ig', 30), log('x', 10, 5), log('ig', 60, 90)], labels: async () => ({ ig: 'distracting' }) });
    expect(await evaluateCondition({ type: 'app_usage_minutes', params: { bundle_id: 'ig', window_minutes: 60, operator: '>=', minutes: 30 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'app_usage_minutes', params: { bundle_id: 'ig', window_minutes: 60, operator: '>=', minutes: 31 } }, c)).toBe(false);
    expect(await evaluateCondition({ type: 'app_usage_minutes', params: { label: 'distracting', window_minutes: 60, operator: '==', minutes: 30 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'app_usage_minutes', params: { window_minutes: 60, operator: '>', minutes: 39 } }, c)).toBe(true);
    // the 60-minute session that ended 90 minutes ago is entirely outside a 60-minute window
    expect(await evaluateCondition({ type: 'app_usage_minutes', params: { bundle_id: 'ig', window_minutes: 120, operator: '>=', minutes: 60 } }, c)).toBe(true);
  });

  it('app_recently_used / app_not_running / no_foreground_activity', async () => {
    const c = ctx({ appLogs: () => [log('ig', 5, 2), log('bg', 5, 0, false)] });
    expect(await evaluateCondition({ type: 'app_recently_used', params: { bundle_id: 'ig', within_seconds: 300 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'app_recently_used', params: { bundle_id: 'ig', within_seconds: 60 } }, c)).toBe(false);
    expect(await evaluateCondition({ type: 'app_not_running', params: { bundle_id: 'ig', min_seconds_not_running: 60 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'app_not_running', params: { bundle_id: 'ig', min_seconds_not_running: 300 } }, c)).toBe(false);
    expect(await evaluateCondition({ type: 'no_foreground_activity', params: { duration_minutes: 1 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'no_foreground_activity', params: { duration_minutes: 5 } }, c)).toBe(false);
  });

  it('obligations set matched context', async () => {
    const ob = { id: 'o', title: 'pset' } as never;
    const c = ctx({ obligationsDueWithin: async () => [ob] });
    expect(await evaluateCondition({ type: 'obligation_due_within', params: { hours: 24 } }, c)).toBe(true);
    expect(c.matched.obligation).toBe(ob);
    expect(await evaluateCondition({ type: 'no_obligation_due_within', params: { hours: 24 } }, c)).toBe(false);
  });

  it('location, activity, health, rate limits', async () => {
    const c = ctx({
      currentLocation: () => ({ latitude: 1, longitude: 2 } as never),
      locationsContaining: async () => ['loc-1'],
      openActivityEntries: async () => [{ id: 'e', activity_id: 'a', start_time: NOW }],
      healthMetric: (m) => (m === 'steps' ? 4000 : null),
      trigger: { id: 't', cooldown_seconds: 0, last_fired_at: new Date(NOW.getTime() - 600_000) } as never,
    });
    expect(await evaluateCondition({ type: 'inside_location', params: { location_id: 'loc-1' } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'outside_location', params: { location_id: 'loc-2' } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'activity_in_progress', params: { activity_id: 'a' } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'no_activity_in_progress', params: {} }, c)).toBe(false);
    expect(await evaluateCondition({ type: 'health_metric', params: { metric: 'steps', operator: '<', value: 10000, window_hours: 24 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'health_metric', params: { metric: 'sleep', operator: '<', value: 10000, window_hours: 24 } }, c)).toBe(false);
    expect(await evaluateCondition({ type: 'cooldown_expired', params: { cooldown_seconds: 300 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'cooldown_expired', params: { cooldown_seconds: 3600 } }, c)).toBe(false);
    expect(await evaluateCondition({ type: 'quota_remaining', params: { max_daily: 1 } }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'interrupt_budget_remaining', params: {} }, c)).toBe(true);
    expect(await evaluateCondition({ type: 'interrupt_budget_remaining', params: {} }, ctx({}, { interrupt_budget_per_day: 2 }))).toBe(false);
  });
});
