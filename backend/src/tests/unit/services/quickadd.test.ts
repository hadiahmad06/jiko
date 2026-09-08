import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '../../../services/quickadd.js';

const NOW = new Date('2026-09-08T15:30:00Z'); // Tuesday 10:30 Chicago

describe('parseQuickAdd', () => {
  it('weekday + time in the user timezone', () => {
    const r = parseQuickAdd('OS midterm thu 2pm', NOW, 'America/Chicago')!;
    expect(r.kind).toBe('event');
    expect(r.title).toBe('OS midterm');
    expect((r as { start_at: Date }).start_at.toISOString()).toBe('2026-09-10T19:00:00.000Z');
  });
  it('"due friday" defaults to end of day; past weekday rolls a week', () => {
    const r = parseQuickAdd('pset 3 due friday', NOW, 'UTC')!;
    expect(r.title).toBe('pset 3');
    expect((r as { due_at: Date }).due_at.toISOString()).toBe('2026-09-11T23:59:00.000Z');
    const t = parseQuickAdd('laundry tuesday', NOW, 'UTC')!;
    expect((t as { due_at: Date }).due_at.toISOString()).toBe('2026-09-15T23:59:00.000Z');
  });
  it('relative and tonight/tomorrow', () => {
    expect((parseQuickAdd('call mom in 2 hours', NOW)! as { due_at: Date }).due_at.toISOString()).toBe('2026-09-08T17:30:00.000Z');
    expect((parseQuickAdd('gym tonight', NOW, 'UTC')! as { due_at: Date }).due_at.toISOString()).toBe('2026-09-08T21:00:00.000Z');
    expect((parseQuickAdd('essay tomorrow 9am', NOW, 'UTC')! as { due_at: Date }).due_at.toISOString()).toBe('2026-09-09T09:00:00.000Z');
    expect(parseQuickAdd('essay tomorrow 9am', NOW, 'UTC')!.title).toBe('essay');
  });
  it('a bare time earlier than now means tomorrow', () => {
    expect((parseQuickAdd('standup at 9:00', NOW, 'UTC')! as { due_at: Date }).due_at.toISOString()).toBe('2026-09-09T09:00:00.000Z');
  });
  it('returns null when there is no date', () => {
    expect(parseQuickAdd('just some words', NOW)).toBeNull();
  });
});
