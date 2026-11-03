import { describe, it, expect, beforeAll } from 'vitest';
import { seal, unseal, sealJson, unsealJson } from '../../../lib/secretBox.js';
import { signOAuthState, verifyOAuthState, verifyAccessToken } from '../../../lib/jwt.js';
import { extractFromEmail, parseEmailDate } from '../../../services/integrations/gmailExtract.js';
import { mapPlannerItems, nextLink, normalizeCanvasUrl } from '../../../services/integrations/canvas.js';
import { mapCalendarEvents, emailFromIdToken, authUrl } from '../../../services/integrations/google.js';
import type { GmailMessage } from '../../../services/integrations/google.js';

beforeAll(() => {
  process.env.JIKO_TOKEN_KEY = 'a'.repeat(64);
  process.env.JWT_SECRET ||= 'unit-access';
  process.env.JWT_REFRESH_SECRET ||= 'unit-refresh';
});

describe('secretBox', () => {
  it('round-trips and never stores plaintext', () => {
    const sealed = seal('refresh-token-123');
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(sealed).not.toContain('refresh-token-123');
    expect(unseal(sealed)).toBe('refresh-token-123');
    expect(unsealJson<{ t: string }>(sealJson({ t: 'x' }))).toEqual({ t: 'x' });
  });

  it('refuses a different key', () => {
    const sealed = seal('secret');
    const keep = process.env.JIKO_TOKEN_KEY;
    process.env.JIKO_TOKEN_KEY = 'b'.repeat(64);
    expect(() => unseal(sealed)).toThrow();
    process.env.JIKO_TOKEN_KEY = keep;
  });
});

describe('OAuth state', () => {
  it('round-trips and is not usable as an access token', () => {
    const s = signOAuthState({ user_id: '6f1c1e9e-0000-4000-8000-000000000001', provider: 'google', ret: 'setup' });
    expect(verifyOAuthState(s)).toEqual({ user_id: '6f1c1e9e-0000-4000-8000-000000000001', provider: 'google', ret: 'setup' });
    expect(verifyAccessToken(s)).toBeNull();
    expect(verifyOAuthState(s + 'x')).toBeNull();
  });
});

describe('Google', () => {
  it('builds an offline, consenting auth URL with both scopes', () => {
    process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.JIKO_PUBLIC_URL = 'https://jiko.example/';
    const u = new URL(authUrl('st'));
    expect(u.searchParams.get('redirect_uri')).toBe('https://jiko.example/integrations/google/callback');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('scope')).toContain('gmail.readonly');
    expect(u.searchParams.get('scope')).toContain('calendar.readonly');
  });

  it('reads the email from an id_token', () => {
    const payload = Buffer.from(JSON.stringify({ email: 'a@b.com' })).toString('base64url');
    expect(emailFromIdToken(`x.${payload}.y`)).toBe('a@b.com');
    expect(emailFromIdToken(undefined)).toBeNull();
  });

  it('maps calendar events, skipping cancelled, declined and non-default ones', () => {
    const items = mapCalendarEvents([
      { calendarId: 'primary', calendarName: 'me@x.com', event: { id: '1', summary: 'Standup', start: { dateTime: '2026-11-05T15:00:00Z' }, end: { dateTime: '2026-11-05T15:15:00Z' } } },
      { calendarId: 'primary', calendarName: 'me@x.com', event: { id: '2', summary: 'Holiday', start: { date: '2026-11-26' }, end: { date: '2026-11-27' } } },
      { calendarId: 'primary', calendarName: 'me@x.com', event: { id: '3', status: 'cancelled', start: { dateTime: '2026-11-05T15:00:00Z' } } },
      { calendarId: 'primary', calendarName: 'me@x.com', event: { id: '4', summary: 'No', start: { dateTime: '2026-11-05T15:00:00Z' }, attendees: [{ self: true, responseStatus: 'declined' }] } },
      { calendarId: 'primary', calendarName: 'me@x.com', event: { id: '5', summary: 'Office', eventType: 'workingLocation', start: { date: '2026-11-05' } } },
    ], 'google_calendar:x');
    expect(items.map(i => i.title)).toEqual(['Standup', 'Holiday']);
    expect(items[0]).toMatchObject({ kind: 'event', external_ref: 'primary:1', all_day: false, source: 'google_calendar:x' });
    expect(items[1]!.all_day).toBe(true);
  });
});

describe('Gmail extraction', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const msg = (subject: string, snippet = '', extra: Partial<GmailMessage> = {}): GmailMessage => ({
    id: 'm1', internalDate: now.getTime() - 3600_000, labelIds: ['INBOX'], subject, from: '"Acme Recruiting" <jobs@acme.com>', snippet, ...extra,
  });
  const run = (m: GmailMessage) => extractFromEmail(m, { now, timezone: 'America/Chicago', source: 'gmail:x' });

  it('turns an interview with a date and time into an event', () => {
    const o = run(msg('Interview confirmation: Nov 12 at 2:30pm', 'Looking forward to speaking with you'));
    expect(o).toMatchObject({ kind: 'event', title: 'Interview confirmation: Nov 12 at 2:30pm', external_ref: 'm1' });
    expect(o!.start_at!.toISOString()).toBe('2026-11-12T20:30:00.000Z'); // 2:30pm CST
    expect(o!.description).toContain('Acme Recruiting');
  });

  it('reads a deadline from the snippet when the subject has none', () => {
    const o = run(msg('Your application', 'Please submit the take-home by 11/10.'));
    expect(o).toMatchObject({ kind: 'task' });
    expect(o!.due_at!.toISOString()).toBe('2026-11-11T05:59:00.000Z'); // 23:59 CST
  });

  it('ignores mail with no commitment, no date, a past date, or a duplicate source', () => {
    expect(run(msg('Lunch?', 'want to grab food Nov 12'))).toBeNull();
    expect(run(msg('Interview next steps', 'we will be in touch soon'))).toBeNull();
    expect(run(msg('Deadline was Oct 1', ''))).toBeNull();
    expect(run(msg('Assignment due Nov 12', '', { from: 'Canvas <notifications@instructure.com>' }))).toBeNull();
    expect(run(msg('Exam reminder Nov 12', '', { labelIds: ['CATEGORY_PROMOTIONS'] }))).toBeNull();
  });

  it('strips reply prefixes from titles', () => {
    expect(run(msg('Re: Fwd: Interview Nov 20 10am'))!.title).toBe('Interview Nov 20 10am');
  });

  it('rolls a month-day past the year end forward', () => {
    const sent = new Date('2026-12-20T12:00:00Z');
    expect(parseEmailDate('due Jan 5', sent, 'UTC')!.at.toISOString()).toBe('2027-01-05T23:59:00.000Z');
  });
});

describe('Canvas', () => {
  it('normalizes school addresses to an https origin', () => {
    expect(normalizeCanvasUrl('canvas.school.edu')).toEqual({ ok: true, url: 'https://canvas.school.edu' });
    expect(normalizeCanvasUrl('https://school.instructure.com/courses/12')).toEqual({ ok: true, url: 'https://school.instructure.com' });
    expect(normalizeCanvasUrl('http://school.instructure.com').ok).toBe(false);
    expect(normalizeCanvasUrl('https://192.168.1.4').ok).toBe(false);
    expect(normalizeCanvasUrl('nonsense').ok).toBe(false);
  });

  it('follows rel=next', () => {
    expect(nextLink('<https://c.edu/api/v1/planner/items?page=2>; rel="next", <https://c.edu/x?page=1>; rel="first"')).toBe('https://c.edu/api/v1/planner/items?page=2');
    expect(nextLink('<https://c.edu/x?page=1>; rel="first"')).toBeNull();
    expect(nextLink(null)).toBeNull();
  });

  it('maps planner items and marks submitted ones complete', () => {
    const items = mapPlannerItems([
      { plannable_type: 'assignment', plannable_id: 1, context_name: 'CS 341', plannable: { title: 'Pset 4', due_at: '2026-11-06T05:59:00Z' }, submissions: { submitted: false } },
      { plannable_type: 'assignment', plannable_id: 2, context_name: 'CS 341', plannable: { title: 'Pset 3', due_at: '2026-11-04T05:59:00Z' }, submissions: { submitted: true } },
      { plannable_type: 'quiz', plannable_id: 3, plannable: { title: 'Quiz 2' }, plannable_date: '2026-11-07T15:00:00Z', submissions: false, planner_override: { marked_complete: true } },
      { plannable_type: 'calendar_event', plannable_id: 4, plannable: { title: 'Midterm review', start_at: '2026-11-08T18:00:00Z', end_at: '2026-11-08T19:00:00Z' } },
      { plannable_type: 'announcement', plannable_id: 5, plannable: { title: 'Welcome' }, plannable_date: '2026-11-03T15:00:00Z' },
      { plannable_type: 'assignment', plannable_id: 6, plannable: { title: 'Hidden' }, plannable_date: '2026-11-03T15:00:00Z', planner_override: { dismissed: true } },
    ], 'canvas:x');
    expect(items.map(i => [i.title, i.kind, i.completed])).toEqual([
      ['Pset 4', 'task', false],
      ['Pset 3', 'task', true],
      ['Quiz 2', 'task', true],
      ['Midterm review', 'event', false],
    ]);
    expect(items[0]).toMatchObject({ description: 'CS 341', external_ref: 'assignment:1', source: 'canvas:x' });
  });
});
