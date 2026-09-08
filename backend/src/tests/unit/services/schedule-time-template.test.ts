import { describe, it, expect } from 'vitest';
import { firstRun, nextRun } from '../../../services/triggers/schedule.js';
import { humanizeDelta, inRange, localHHMM, localWeekday, startOfLocalDay } from '../../../services/triggers/time.js';
import { renderTemplate } from '../../../services/messaging/template.js';
import { usageWindow } from '../../../services/triggers/context.js';
import { deltasByDay, localDay } from '../../../services/repositories/UsageRepository.js';

const NOW = new Date('2026-09-08T15:30:00Z');

describe('schedule', () => {
  it('one-shot in the future runs at `at`, then never again', () => {
    const m = { at: '2026-09-09T10:00:00Z' };
    expect(firstRun(m, NOW).toISOString()).toBe('2026-09-09T10:00:00.000Z');
    expect(nextRun(m, NOW)).toBeNull();
  });
  it('a past `at` is due immediately once; recurrence then computes strictly after now', () => {
    const m = { at: '2026-09-01T21:30:00Z', recurrence: { interval: 1, unit: 'days' as const } };
    expect(firstRun(m, NOW).toISOString()).toBe('2026-09-01T21:30:00.000Z');
    expect(nextRun(m, new Date('2026-09-08T21:30:00Z'))!.toISOString()).toBe('2026-09-09T21:30:00.000Z');
    expect(nextRun({ at: '2026-09-08T15:00:00Z', recurrence: { interval: 20, unit: 'minutes' } }, NOW)!.toISOString()).toBe('2026-09-08T15:40:00.000Z');
  });
});

describe('time helpers', () => {
  it('local HH:MM, weekday, day start', () => {
    expect(localHHMM(NOW, 'UTC')).toBe('15:30');
    expect(localHHMM(NOW, 'America/Chicago')).toBe('10:30');
    expect(localHHMM(new Date('2026-09-08T04:30:00Z'), 'America/Chicago')).toBe('23:30');
    expect(localWeekday(NOW, 'Asia/Tokyo')).toBe('wednesday');
    expect(startOfLocalDay(NOW, 'America/Chicago').toISOString()).toBe('2026-09-08T05:00:00.000Z');
    expect(localDay(new Date('2026-09-08T04:30:00Z'), 'America/Chicago')).toBe('2026-09-07');
  });
  it('inRange wraps midnight', () => {
    expect(inRange('23:30', '23:00', '08:00')).toBe(true);
    expect(inRange('07:59', '23:00', '08:00')).toBe(true);
    expect(inRange('12:00', '23:00', '08:00')).toBe(false);
    expect(inRange('12:00', '09:00', '17:00')).toBe(true);
  });
  it('humanizeDelta', () => {
    expect(humanizeDelta(NOW, new Date(NOW.getTime() + 20 * 60_000))).toBe('in 20 min');
    expect(humanizeDelta(NOW, new Date(NOW.getTime() + 6 * 3600_000))).toBe('in 6 hours');
    expect(humanizeDelta(NOW, new Date(NOW.getTime() - 2 * 86_400_000))).toBe('2 days ago');
    expect(humanizeDelta(NOW, NOW)).toBe('now');
  });
});

describe('template', () => {
  it('fills known vars, blanks unknown, squashes whitespace', () => {
    expect(renderTemplate('{{minutes}} min on {{app}}.{{nope}} ok', { minutes: 25, app: 'Instagram' })).toBe('25 min on Instagram. ok');
    expect(renderTemplate('  hi   {{ name }} ', { name: 'h' })).toBe('hi h');
  });
});

describe('usage math', () => {
  const log = (b: string, minutes: number, endMinutesAgo = 0) => {
    const end = new Date(NOW.getTime() - endMinutesAgo * 60_000);
    return { bundleId: b, appName: b, timestamp: end.toISOString(), startTime: new Date(end.getTime() - minutes * 60_000).toISOString(), durationSeconds: minutes * 60, isForeground: true };
  };
  it('usageWindow clips sessions that straddle the window edge', () => {
    const w = usageWindow([log('a', 30, 45), log('a', 10, 0)], NOW, 60);
    // first session ran 75..45 min ago; only 15 min inside the window
    expect(Math.round(w.get('a')!.seconds / 60)).toBe(25);
  });
  it('deltasByDay buckets by local day', () => {
    const d = deltasByDay([log('a', 10, 0), { ...log('a', 5, 0), startTime: '2026-09-07T23:50:00Z', timestamp: '2026-09-07T23:55:00Z' }], 'UTC');
    expect([...d.keys()].sort()).toEqual(['2026-09-07', '2026-09-08']);
    expect(d.get('2026-09-08')!.get('a')).toMatchObject({ seconds: 600, opens: 1 });
  });
});
