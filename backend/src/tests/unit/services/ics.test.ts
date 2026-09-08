import { describe, it, expect } from 'vitest';
import { icsToObligations, parseIcs } from '../../../services/ics.js';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:abc@example.com
SUMMARY:CSCI 4061 Midterm
DTSTART;TZID=America/Chicago:20260910T140000
DTEND;TZID=America/Chicago:20260910T151500
LOCATION:Keller 3-210
END:VEVENT
BEGIN:VEVENT
UID:pset@example.com
SUMMARY:PSet 3 due
DESCRIPTION:Submit on Canvas\\, chapters 4-6
DTSTART:20260912T045900Z
END:VEVENT
BEGIN:VEVENT
UID:allday@example.com
SUMMARY:Reading day
DTSTART;VALUE=DATE:20260915
DTEND;VALUE=DATE:20260916
END:VEVENT
BEGIN:VEVENT
UID:old@example.com
SUMMARY:Last year
DTSTART:20250101T100000Z
END:VEVENT
END:VCALENDAR
`;

describe('ics', () => {
  it('parses events with tz, utc, all-day, and folded/escaped text', () => {
    const evs = parseIcs(ICS);
    expect(evs).toHaveLength(4);
    expect(evs[1]!.description).toBe('Submit on Canvas, chapters 4-6');
  });
  it('maps to obligations inside the window, classifying "due" as tasks', () => {
    const now = new Date('2026-09-08T00:00:00Z');
    const items = icsToObligations(ICS, { from: now, to: new Date('2026-10-08T00:00:00Z') });
    expect(items.map(i => i.title)).toEqual(['CSCI 4061 Midterm', 'PSet 3 due', 'Reading day']);
    expect(items[0]).toMatchObject({ kind: 'event', external_ref: 'abc@example.com' });
    expect((items[0]!.start_at as Date).toISOString()).toBe('2026-09-10T19:00:00.000Z');
    expect((items[0]!.end_at as Date).toISOString()).toBe('2026-09-10T20:15:00.000Z');
    expect(items[1]).toMatchObject({ kind: 'task' });
    expect((items[1]!.due_at as Date).toISOString()).toBe('2026-09-12T04:59:00.000Z');
    expect(items[2]).toMatchObject({ kind: 'event', all_day: true });
  });
});
