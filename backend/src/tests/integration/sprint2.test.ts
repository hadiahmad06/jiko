// Sprint 2's paths over HTTP: calendar subscriptions, goal progress, the
// weekly reflection, quiet mode, the SMS webhook, and "why did I get this?".
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import createApp from '../../app.js';
import { resetDb, createUser, api, usagePayload } from './helpers.js';
import { query } from '../../db/psqlClient.js';
import { sweepOnce } from '../../services/triggers/scheduler.js';

let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp(); });
beforeEach(resetDb);
afterEach(() => { vi.unstubAllGlobals(); });

const IG = 'com.burbn.instagram';

const ICS = (uid: string, summary: string, start: Date) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:${uid}
SUMMARY:${summary}
DTSTART:${start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}
DTEND:${new Date(start.getTime() + 3600_000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}
END:VEVENT
END:VCALENDAR`;

/** A fetch that answers one URL with a calendar, and counts the calls. */
function stubCalendarFetch(body: string) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string | URL) => {
    calls.push(String(url));
    return new Response(body, { status: 200, headers: { 'content-type': 'text/calendar' } });
  });
  return calls;
}

describe('calendar subscriptions', () => {
  it('imports on add, re-imports in place, and is re-run by the sweep', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    const start = new Date(Date.now() + 2 * 86_400_000);
    const calls = stubCalendarFetch(ICS('evt-1', 'Algorithms lecture', start));

    const added = await c.post('/calendars', { url: 'webcal://calendar.example.com/feed.ics', name: 'School' });
    expect(added.status).toBe(201);
    expect(added.body.subscription.url).toBe('https://calendar.example.com/feed.ics');
    expect(added.body.import).toMatchObject({ status: 'ok', created: 1, updated: 0 });
    expect(calls).toHaveLength(1);

    const obligations = await c.get('/obligations?limit=10');
    expect(obligations.body).toHaveLength(1);
    expect(obligations.body[0].title).toBe('Algorithms lecture');
    expect(obligations.body[0].source).toBe(`ics:${added.body.subscription.id}`);

    // same UID, new title: updated, not duplicated
    vi.unstubAllGlobals();
    stubCalendarFetch(ICS('evt-1', 'Algorithms lecture (moved)', start));
    const refreshed = await c.post(`/calendars/${added.body.subscription.id}/refresh`);
    expect(refreshed.body.import).toMatchObject({ status: 'ok', created: 0, updated: 1 });
    const after = await c.get('/obligations?limit=10');
    expect(after.body).toHaveLength(1);
    expect(after.body[0].title).toBe('Algorithms lecture (moved)');

    // the sweep only picks it up once the refresh window has elapsed
    const beforeSweep = (await c.get('/calendars')).body[0].last_imported_at;
    await sweepOnce();
    expect((await c.get('/calendars')).body[0].last_imported_at).toBe(beforeSweep);

    await query(`UPDATE calendar_subscriptions SET last_imported_at = NOW() - INTERVAL '2 days' WHERE user_id = $1`, [u.id]);
    await sweepOnce();
    expect((await c.get('/calendars')).body[0].last_imported_at).not.toBe(beforeSweep);
  });

  it('refuses a private or non-https url, and records a failed fetch', async () => {
    const u = await createUser();
    const c = api(app, u.token);

    const priv = await c.post('/calendars', { url: 'https://127.0.0.1/feed.ics' });
    expect(priv.status).toBe(400);
    expect(priv.body.message).toMatch(/not reachable/);

    expect((await c.post('/calendars', { url: 'http://calendar.example.com/f.ics' })).status).toBe(400);

    vi.stubGlobal('fetch', async () => new Response('nope', { status: 404 }));
    const added = await c.post('/calendars', { url: 'https://calendar.example.com/gone.ics' });
    expect(added.status).toBe(201);
    expect(added.body.import.status).toBe('error');
    expect(added.body.subscription.last_status).toBe('error');
    expect(added.body.subscription.last_error).toMatch(/404/);

    // a subscription that keeps failing is still listed, so the user can fix it
    expect((await c.get('/calendars')).body).toHaveLength(1);
  });

  it('keeps the obligations it created when the subscription is deleted', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    stubCalendarFetch(ICS('evt-2', 'Lab', new Date(Date.now() + 86_400_000)));
    const added = await c.post('/calendars', { url: 'https://calendar.example.com/feed.ics' });

    expect((await c.delete(`/calendars/${added.body.subscription.id}`)).status).toBe(204);
    expect((await c.get('/calendars')).body).toHaveLength(0);
    expect((await c.get('/obligations?limit=10')).body).toHaveLength(1);
  });
});

describe('goal progress', () => {
  it('fires the weekly check when a goal is behind, and stays quiet when it is on pace', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 5, timezone: 'UTC' });

    const activity = await c.post('/activities', { name: 'reading' });
    expect(activity.status).toBe(201);
    const goal = await c.post('/obligations', {
      kind: 'goal', title: 'reading', activity_id: activity.body.id, target_minutes: 180, timeframe_days: 7,
    });
    expect(goal.status).toBe(201);

    // 40 minutes logged two days ago: behind 3h/week
    await query(
      `INSERT INTO activity_entries (id, user_id, activity_id, start_time, end_time, logged_by)
       VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '40 minutes', 'user')`,
      [u.id, activity.body.id]
    );
    // the goal has to be old enough that the window is far enough along
    await query(`UPDATE obligations SET created_at = NOW() - INTERVAL '5 days' WHERE id = $1`, [goal.body.id]);

    const trig = await c.post('/triggers/presets/weekly_goal', { percent: 60, at: new Date(Date.now() - 60_000).toISOString() });
    expect(trig.status).toBe(201);

    await sweepOnce();
    const messages = await c.get('/messages?direction=outbound');
    expect(messages.body).toHaveLength(1);
    expect(messages.body[0].body).toMatch(/3h of reading/);
    expect(messages.body[0].body).toMatch(/40 min/);

    // catch up past the target: the next run says nothing
    await query(
      `INSERT INTO activity_entries (id, user_id, activity_id, start_time, end_time, logged_by)
       VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '150 minutes', 'user')`,
      [u.id, activity.body.id]
    );
    await query(`UPDATE triggers SET next_run_at = NOW() - INTERVAL '1 minute', last_fired_at = NULL WHERE id = $1`, [trig.body.id]);
    await sweepOnce();
    expect((await c.get('/messages?direction=outbound')).body).toHaveLength(1);
  });
});

describe('weekly reflection', () => {
  it('stores the answer and puts it in the next morning check-in', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 5, timezone: 'UTC' });

    const trig = await c.post('/triggers/presets/weekly_reflection', { at: new Date(Date.now() - 60_000).toISOString() });
    expect(trig.status).toBe(201);
    await sweepOnce();

    const asked = (await c.get('/messages?direction=outbound')).body[0];
    expect(asked.body).toMatch(/worked this week/);
    expect(asked.metadata.tag).toBe('reflection');
    // a question the user opted into doesn't spend an interrupt
    expect((await c.get('/messages/budget')).body.used).toBe(0);

    const answered = await c.post('/messages', { body: 'mornings before class worked', reply_to_id: asked.id });
    expect(answered.status).toBe(201);
    expect(answered.body.effects[0]).toMatch(/reflection/);
    // "worked" must not be parsed as a command
    expect(answered.body.intent).not.toBe('done');

    const stored = await query<{ body: string }>(
      `SELECT body FROM messages WHERE user_id = $1 AND metadata->>'kind' = 'reflection'`, [u.id]
    );
    expect(stored.rows[0]?.body).toBe('mornings before class worked');

    // monday's check-in can quote it
    await c.post('/obligations', { title: 'pset 4', due_at: new Date(Date.now() + 20 * 3600_000).toISOString() });
    const morning = await c.post('/triggers/presets/morning_checkin', { at: new Date(Date.now() - 60_000).toISOString() });
    await query(`UPDATE triggers SET fire_count = 1 WHERE id = $1`, [morning.body.id]);   // pick the reflection variant
    await sweepOnce();

    const outbound = (await c.get('/messages?direction=outbound')).body;
    expect(outbound.some((m: { body: string }) => m.body.includes('mornings before class worked'))).toBe(true);
  });
});

describe('quiet mode', () => {
  it('holds a nudge while a device reports a focus, and lets it through once the lease ends', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 5, timezone: 'UTC' });
    await c.put('/usage/apps/labels', { labels: [{ bundle_id: IG, label: 'distracting' }] });
    const trig = await c.post('/triggers/presets/doomscroll', { minutes: 20, cooldown_minutes: 0 });

    expect((await c.put('/users/quiet', { active: true, minutes: 10, reason: 'focus: Work' })).status).toBe(200);
    const budget = await c.get('/messages/budget');
    expect(budget.body.quiet_mode_active).toBe(true);
    expect(budget.body.quiet_reason).toBe('focus: Work');

    let sync = await c.post('/sync/app-usage', usagePayload(IG, 25, { appName: 'Instagram' }));
    expect(sync.body.triggered_ids).toEqual([trig.body.id]);
    expect(sync.body.firings[0].results[0]).toMatchObject({ ok: false, detail: 'quiet_mode' });
    expect((await c.get('/messages/queued')).body).toHaveLength(0);

    // ending the focus lets the next one through
    expect((await c.put('/users/quiet', { active: false })).status).toBe(200);
    expect((await c.get('/messages/budget')).body.quiet_mode_active).toBe(false);
    sync = await c.post('/sync/app-usage', usagePayload(IG, 5, { appName: 'Instagram' }));
    expect(sync.body.triggered_ids).toEqual([trig.body.id]);
    expect((await c.get('/messages/queued')).body).toHaveLength(1);
  });
});

describe('why did I get this', () => {
  it('explains a nudge from its firing, and is honest when there is none', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 5, timezone: 'UTC' });
    await c.put('/usage/apps/labels', { labels: [{ bundle_id: IG, label: 'distracting' }] });
    const trig = await c.post('/triggers/presets/doomscroll', { minutes: 20 });

    await c.post('/sync/app-usage', usagePayload(IG, 25, { appName: 'Instagram' }));
    const nudge = (await c.get('/messages/queued')).body[0];

    const why = await c.get(`/messages/${nudge.id}/why`);
    expect(why.status).toBe(200);
    expect(why.body.trigger.id).toBe(trig.body.id);
    expect(why.body.reason).toMatch(/25 min on Instagram/);

    const withFiring = await c.get('/triggers?include=last_firing');
    expect(withFiring.body[0].last_firing.reason).toMatch(/25 min on Instagram/);

    // a self-send has no firing behind it
    const own = await c.post('/messages/send', { body: 'note to self' });
    const ownWhy = await c.get(`/messages/${own.body.id}/why`);
    expect(ownWhy.body.trigger).toBeNull();
    expect(ownWhy.body.reason).toMatch(/you asked for this one/);
  });
});

describe('inbound sms webhook', () => {
  it('matches a number to a user, answers, and ignores a replay', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.post('/obligations', { title: 'pset 3', due_at: new Date(Date.now() + 3600_000).toISOString() });

    const sns = JSON.stringify({
      Type: 'Notification',
      Message: JSON.stringify({ originationNumber: u.phone, messageBody: 'done', inboundMessageId: 'sms-1' }),
    });

    const res = await request(app).post('/webhooks/sms').set('content-type', 'text/plain').send(sns);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, matched: true, intent: 'done' });

    const obligations = await c.get('/obligations?limit=10&completed=true');
    expect(obligations.body[0].completed).toBe(true);

    // replay of the same provider id changes nothing
    const again = await request(app).post('/webhooks/sms').set('content-type', 'text/plain').send(sns);
    expect(again.body).toMatchObject({ ok: true, duplicate: true });
  });

  it('drops a number that belongs to no user', async () => {
    const res = await request(app).post('/webhooks/sms').send({ from: '+15550000000', body: 'hello?' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, matched: false });
  });
});

describe('wrong-nudge feedback', () => {
  it('records a verdict and turns a rule off after three wrong ones in a week', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 9, timezone: 'UTC' });
    await c.put('/usage/apps/labels', { labels: [{ bundle_id: IG, label: 'distracting' }] });
    const trig = await c.post('/triggers/presets/doomscroll', { minutes: 20, cooldown_minutes: 0 });

    const nudge = async () => {
      await c.post('/sync/app-usage', usagePayload(IG, 25, { appName: 'Instagram' }));
      const queued = (await c.get('/messages/queued')).body;
      const last = queued[queued.length - 1];
      await c.post('/messages/ack', { ids: [last.id], status: 'delivered' });
      return last;
    };

    const first = await c.post(`/messages/${(await nudge()).id}/feedback`, { verdict: 'wrong', note: 'i was replying to my mom' });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ wrong_in_window: 1, disabled_trigger: false });

    const second = await c.post(`/messages/${(await nudge()).id}/feedback`, { verdict: 'wrong' });
    expect(second.body.wrong_in_window).toBe(2);
    expect((await c.get(`/triggers/${trig.body.id}`)).body.enabled).toBe(true);

    const third = await c.post(`/messages/${(await nudge()).id}/feedback`, { verdict: 'wrong' });
    expect(third.body).toMatchObject({ wrong_in_window: 3, disabled_trigger: true });
    expect((await c.get(`/triggers/${trig.body.id}`)).body.enabled).toBe(false);

    // it says so rather than going quiet
    const outbound = (await c.get('/messages?direction=outbound')).body;
    expect(outbound.some((m: { body: string }) => m.body.includes('turning it off'))).toBe(true);
    // and the explanation never spends an interrupt
    expect((await c.get('/messages/budget')).body.used).toBe(3);

    const rules = await c.get('/triggers?include=last_firing');
    expect(rules.body[0]).toMatchObject({ wrong_recently: 3, wrong_limit: 3 });
  });

  it('refuses to grade the user\'s own message', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    const mine = await c.post('/messages', { body: 'hey' });
    const res = await c.post(`/messages/${mine.body.message.id}/feedback`, { verdict: 'wrong' });
    expect(res.status).toBe(400);
  });
});

describe('message pagination', () => {
  it('walks backwards with the cursor header and never repeats a message', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    for (let i = 0; i < 7; i++) {
      await c.post('/messages/send', { body: `note ${i}`, counts_as_interrupt: false });
    }

    const first = await c.get('/messages?limit=3');
    expect(first.body).toHaveLength(3);
    const cursor = first.headers['x-jiko-next-before'] as string;
    expect(cursor).toBeTruthy();

    const second = await c.get(`/messages?limit=3&before=${encodeURIComponent(cursor)}`);
    expect(second.body).toHaveLength(3);
    const ids = new Set([...first.body, ...second.body].map((m: { id: string }) => m.id));
    expect(ids.size).toBe(6);

    // the last page is short and carries no cursor
    const third = await c.get(`/messages?limit=3&before=${encodeURIComponent(second.headers['x-jiko-next-before'] as string)}`);
    expect(third.body).toHaveLength(1);
    expect(third.headers['x-jiko-next-before']).toBeUndefined();
  });
});

describe('adaptive budget', () => {
  it('spends less after a run of ignored nudges, and everything when something is due', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 4, timezone: 'UTC' });

    // four unsolicited nudges yesterday, none of them answered
    for (let i = 0; i < 4; i++) {
      await c.post('/messages/send', { body: `nudge ${i}` });
    }
    await query(`UPDATE messages SET created_at = NOW() - INTERVAL '1 day' WHERE user_id = $1`, [u.id]);

    const quiet = await c.get('/messages/budget');
    expect(quiet.body).toMatchObject({ budget_set: 4, budget: 2, budget_reason: 'mostly_ignored' });

    // a deadline buys back the full budget
    await c.post('/obligations', { title: 'pset 3', due_at: new Date(Date.now() + 6 * 3600_000).toISOString() });
    const urgent = await c.get('/messages/budget');
    expect(urgent.body).toMatchObject({ budget_set: 4, budget: 4, budget_reason: 'deadline' });
  });
});
