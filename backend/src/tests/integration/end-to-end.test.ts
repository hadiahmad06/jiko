// The sprint's acceptance path, over HTTP only:
// signup -> label apps -> obligation -> preset trigger -> sync usage -> message queued -> talk back
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import createApp from '../../app.js';
import { resetDb, createUser, api, usagePayload } from './helpers.js';
import { sweepOnce } from '../../services/triggers/scheduler.js';

let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp(); });
beforeEach(resetDb);

const IG = 'com.burbn.instagram';

describe('deadline drift, end to end', () => {
  it('fires once, queues a rendered message, respects cooldown, and hears "snooze"', async () => {
    const u = await createUser({ nickname: 'hadi' });
    const c = api(app, u.token);

    // quiet hours off for the test; generous budget
    expect((await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 5, timezone: 'UTC' })).status).toBe(200);
    expect((await c.put('/usage/apps/labels', { labels: [{ bundle_id: IG, label: 'distracting' }] })).status).toBe(200);

    const due = new Date(Date.now() + 6 * 3600_000).toISOString();
    const ob = await c.post('/obligations', { title: 'OS midterm', due_at: due });
    expect(ob.status).toBe(201);

    const trig = await c.post('/triggers/presets/deadline_drift', { minutes: 20, hours_before: 24 });
    expect(trig.status).toBe(201);
    expect(trig.body.kind).toBe('app_usage');

    // 10 minutes: below threshold, nothing fires
    let sync = await c.post('/sync/app-usage', usagePayload(IG, 10, { appName: 'Instagram' }));
    expect(sync.status).toBe(200);
    expect(sync.body.triggered_ids).toEqual([]);

    // another 15 minutes in the same hour: 25 total, fires
    sync = await c.post('/sync/app-usage', usagePayload(IG, 15, { appName: 'Instagram' }));
    expect(sync.body.triggered_ids).toEqual([trig.body.id]);
    expect(sync.body.firings[0].results).toEqual([{ action: 'notify_user', ok: true, ref: expect.any(String), detail: 'queued' }]);

    const queued = await c.get('/messages/queued');
    expect(queued.body).toHaveLength(1);
    const body: string = queued.body[0].body;
    expect(body).toMatch(/25 min on Instagram/);
    expect(body).toMatch(/OS midterm is due in 6 hours/);

    // cooldown: a third sync does not fire again
    sync = await c.post('/sync/app-usage', usagePayload(IG, 5, { appName: 'Instagram' }));
    expect(sync.body.triggered_ids).toEqual([]);

    // agent acks delivery
    expect((await c.post('/messages/ack', { ids: [queued.body[0].id], status: 'delivered' })).body.updated).toBe(1);
    expect((await c.get('/messages/queued')).body).toHaveLength(0);

    // user talks back
    const reply = await c.post('/messages', { body: 'snooze 45', reply_to_id: queued.body[0].id });
    expect(reply.status).toBe(201);
    expect(reply.body.intent).toBe('snooze');
    expect(reply.body.effects[0]).toMatch(/snoozed/);
    const t = await c.get(`/triggers/${trig.body.id}`);
    expect(new Date(t.body.last_fired_at).getTime()).toBeGreaterThan(Date.now() + 40 * 60_000);

    // and "done" completes the obligation
    const done = await c.post('/messages', { body: 'done with the midterm' });
    expect(done.body.intent).toBe('done');
    expect((await c.get(`/obligations/${ob.body.id}`)).body.completed).toBe(true);

    // conversation is recorded in both directions
    const all = await c.get('/messages');
    const directions = all.body.map((m: { direction: string }) => m.direction).sort();
    expect(directions).toEqual(['inbound', 'inbound', 'outbound', 'outbound', 'outbound']);
    expect(await c.get('/triggers/firings').then(r => r.body)).toHaveLength(1);
  });

  it('interrupt budget stops unsolicited nudges but not replies', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' }, interrupt_budget_per_day: 1 });
    expect((await c.post('/messages/send', { body: 'one' })).status).toBe(201);
    expect((await c.post('/messages/send', { body: 'two' })).status).toBe(409);
    const reply = await c.post('/messages', { body: 'help' });
    expect(reply.body.reply).toMatch(/snooze/);
    const budget = await c.get('/messages/budget');
    expect(budget.body).toMatchObject({ used: 1, budget: 1, remaining: 0 });
  });

  it('quiet hours block nudges unless urgent', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '00:00', end: '23:59' } });
    expect((await c.post('/messages/send', { body: 'shh' })).status).toBe(409);
    expect((await c.post('/messages/send', { body: 'fire!', urgent: true })).status).toBe(201);
  });
});

describe('location triggers, end to end', () => {
  it('enter starts an activity, exit stops it', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    const gym = await c.post('/locations', { name: 'Gym', latitude: 44.9740, longitude: -93.2277, radius_m: 100 });
    expect(gym.status).toBe(201);
    const act = await c.post('/activities', { name: 'Workout' });
    expect(act.status).toBe(201);
    expect((await c.post('/triggers/presets/arrive', { location_id: gym.body.id, activity_id: act.body.id })).status).toBe(201);
    expect((await c.post('/triggers/presets/leave', { location_id: gym.body.id, activity_id: act.body.id })).status).toBe(201);

    const at = (lat: number, lon: number, minutesAgo = 0) => ({ timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(), platform: 'ios', device_id: 'ph', latitude: lat, longitude: lon, radius: 10 });
    // far away, then inside
    expect((await c.post('/sync/location', at(44.99, -93.30, 3))).body.triggered_ids).toEqual([]);
    let r = await c.post('/sync/location', at(44.97402, -93.22772, 2));
    expect(r.body.firings).toHaveLength(1);
    expect(r.body.firings[0].results[0]).toMatchObject({ action: 'start_activity', ok: true });
    let entries = await c.get(`/activities/${act.body.id}/entries`);
    expect(entries.body).toHaveLength(1);
    expect(entries.body[0].end_time).toBeNull();
    // still inside: nothing
    expect((await c.post('/sync/location', at(44.97405, -93.22770, 1))).body.triggered_ids).toEqual([]);
    // leave
    r = await c.post('/sync/location', at(44.99, -93.30));
    expect(r.body.firings[0].results[0]).toMatchObject({ action: 'stop_activity', ok: true });
    entries = await c.get(`/activities/${act.body.id}/entries`);
    expect(entries.body[0].end_time).not.toBeNull();
    expect(entries.body[0].ended_by).toBe('trigger');
  });
});

describe('scheduled and obligation triggers via the sweep', () => {
  it('nightly summary runs when due and reschedules; deadline reminder fires once per task', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.patch('/users/preferences', { quiet_hours: { start: '03:00', end: '03:01' } });
    await c.put('/usage/apps/labels', { labels: [{ bundle_id: IG, label: 'distracting' }] });
    await c.post('/sync/app-usage', usagePayload(IG, 40, { appName: 'Instagram' }));

    const past = new Date(Date.now() - 60_000).toISOString();
    const nightly = await c.post('/triggers/presets/nightly_summary', { at: past });
    expect(nightly.status).toBe(201);
    await c.post('/triggers/presets/deadline_reminder', { hours_before: 12 });
    const task = await c.post('/obligations/quick', { text: 'submit pset in 3 hours' });
    expect(task.status).toBe(201);
    expect(task.body.kind).toBe('task');

    const reports = await sweepOnce();
    const names = reports.map(r => r.name).sort();
    expect(names).toEqual(['Due within 12h', 'Nightly summary']);

    const msgs = (await c.get('/messages')).body as Array<{ body: string; metadata: Record<string, unknown> }>;
    expect(msgs.some(m => /40 min on distracting apps/.test(m.body))).toBe(true);
    expect(msgs.some(m => /submit pset is due in 3 hours/.test(m.body))).toBe(true);

    // rescheduled a day ahead, and the reminder doesn't repeat
    const t = (await c.get(`/triggers/${nightly.body.id}`)).body;
    expect(new Date(t.next_run_at).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    expect(await sweepOnce()).toEqual([]);
  });
});

describe('usage summary', () => {
  it('rolls up per day and per label', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    await c.put('/usage/apps/labels', { labels: [{ bundle_id: IG, label: 'distracting' }, { bundle_id: 'com.apple.dt.Xcode', label: 'work' }] });
    await c.post('/sync/app-usage', usagePayload(IG, 30, { appName: 'Instagram' }));
    await c.post('/sync/app-usage', usagePayload('com.apple.dt.Xcode', 90, { appName: 'Xcode', device_id: 'mac-2' }));
    const s = await c.get('/usage/summary');
    expect(s.status).toBe(200);
    expect(s.body.by_label.distracting).toBe(1800);
    expect(s.body.by_label.work).toBe(5400);
    expect(s.body.text).toMatch(/1h 30m on work apps/);
    const apps = await c.get('/usage/apps');
    expect(apps.body.map((a: { bundle_id: string }) => a.bundle_id).sort()).toEqual([IG, 'com.apple.dt.Xcode'].sort());
  });
});

describe('devices and triggers CRUD', () => {
  it('registers idempotently and validates match by kind on PATCH', async () => {
    const u = await createUser();
    const c = api(app, u.token);
    const id = '11111111-1111-4111-8111-111111111111';
    expect((await c.post('/users/devices', { id, platform: 'macos', name: 'MBP' })).status).toBe(201);
    expect((await c.post('/users/devices', { id, platform: 'macos', name: 'MBP' })).status).toBe(201);
    expect((await c.get('/users/devices')).body).toHaveLength(1);

    const t = await c.post('/triggers', { kind: 'app_usage', name: 'x', match: { bundle_ids: [IG] }, actions: [{ action: 'log', params: { message: 'hi' } }] });
    expect(t.status).toBe(201);
    expect((await c.patch(`/triggers/${t.body.id}`, { match: { location_id: id } })).status).toBe(400);
    expect((await c.patch(`/triggers/${t.body.id}`, { enabled: false })).body.enabled).toBe(false);
    expect((await c.post('/triggers', { kind: 'app_usage', name: 'bad', match: {}, actions: [{ action: 'nope', params: {} }] })).status).toBe(400);
    expect((await c.delete(`/triggers/${t.body.id}`)).status).toBe(204);
    expect((await c.get('/triggers/presets')).body.length).toBeGreaterThan(5);
  });
});
