// Connected accounts over HTTP: Canvas token connect + sync (submitted work is
// closed, not nagged about), the Google OAuth callback with its first sync,
// the scheduler picking both up, and secrets never leaving the server.
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import createApp from '../../app.js';
import { resetDb, createUser, api } from './helpers.js';
import { query } from '../../db/psqlClient.js';
import { signOAuthState } from '../../lib/jwt.js';
import { sweepOnce } from '../../services/triggers/scheduler.js';

let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => {
  process.env.JIKO_TOKEN_KEY = 'c'.repeat(64);
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.JIKO_PUBLIC_URL = 'https://jiko.test';
  app = await createApp();
});
beforeEach(resetDb);
afterEach(() => { vi.unstubAllGlobals(); });

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

type Route = (url: URL, init?: RequestInit) => Response | null;
function stubFetch(...routes: Route[]) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? 'GET'} ${url.origin}${url.pathname}`);
    for (const r of routes) { const res = r(url, init); if (res) return res; }
    return new Response('not stubbed', { status: 404 });
  });
  return calls;
}

let plannerSubmitted = false;
const canvasRoutes: Route = (url, init) => {
  if (url.origin !== 'https://canvas.school.edu') return null;
  const authz = new Headers(init?.headers).get('authorization');
  if (authz !== 'Bearer good-canvas-token-123') return json({ errors: [{ message: 'Invalid access token.' }] }, { status: 401 });
  if (url.pathname === '/api/v1/users/self') return json({ id: 7, name: 'Friend Person', short_name: 'Friend' });
  if (url.pathname === '/api/v1/planner/items') return json([
    { plannable_type: 'assignment', plannable_id: 1, context_name: 'CS 341', plannable: { title: 'Pset 4', due_at: inDays(2) }, submissions: { submitted: plannerSubmitted } },
    { plannable_type: 'assignment', plannable_id: 2, context_name: 'CS 341', plannable: { title: 'Pset 3', due_at: inDays(1) }, submissions: { submitted: true } },
  ]);
  return null;
};

describe('Canvas', () => {
  beforeEach(() => { plannerSubmitted = false; });

  it('connects with a token, imports open work, and skips what was already submitted', async () => {
    stubFetch(canvasRoutes);
    const u = await createUser();
    const res = await api(app, u.token).post('/integrations/canvas', { base_url: 'canvas.school.edu/courses/1', token: 'good-canvas-token-123' });
    expect(res.status).toBe(201);
    expect(res.body.integration).toMatchObject({ provider: 'canvas', account: 'Friend', base_url: 'https://canvas.school.edu', status: 'active', last_status: 'ok' });
    expect(res.body.sync).toMatchObject({ status: 'ok', created: 1 });
    const rows = await query('SELECT title, completed, source FROM obligations WHERE user_id = $1', [u.id]);
    expect(rows.rows.map(r => r.title)).toEqual(['Pset 4']);
    expect(rows.rows[0]!.source).toMatch(/^canvas:/);

    // the token is sealed at rest and never returned
    const stored = await query('SELECT secret_enc FROM integrations WHERE user_id = $1', [u.id]);
    expect(stored.rows[0]!.secret_enc).not.toContain('good-canvas-token-123');
    const list = await api(app, u.token).get('/integrations');
    expect(JSON.stringify(list.body)).not.toMatch(/secret|good-canvas-token/);
    expect(list.body.available).toEqual({ google: true, canvas: true });
  });

  it('closes an assignment once Canvas says it was submitted', async () => {
    stubFetch(canvasRoutes);
    const u = await createUser();
    await api(app, u.token).post('/integrations/canvas', { base_url: 'https://canvas.school.edu', token: 'good-canvas-token-123' });
    plannerSubmitted = true;
    const res = await api(app, u.token).post('/integrations/canvas/sync');
    expect(res.body.sync).toMatchObject({ status: 'ok', completed: 1 });
    const row = await query("SELECT completed, completed_at FROM obligations WHERE user_id = $1 AND title = 'Pset 4'", [u.id]);
    expect(row.rows[0]!.completed).toBe(true);
    expect(row.rows[0]!.completed_at).not.toBeNull();
  });

  it('rejects a bad token without storing anything', async () => {
    stubFetch(canvasRoutes);
    const u = await createUser();
    const res = await api(app, u.token).post('/integrations/canvas', { base_url: 'canvas.school.edu', token: 'wrong-token-000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CanvasRejected');
    expect((await query('SELECT COUNT(*)::int AS n FROM integrations')).rows[0]!.n).toBe(0);
  });
});

const idToken = `x.${Buffer.from(JSON.stringify({ email: 'friend@gmail.com' })).toString('base64url')}.y`;
let refreshFails = false;
const googleRoutes: Route = (url, init) => {
  if (url.href === 'https://oauth2.googleapis.com/token') {
    const body = new URLSearchParams(String(init?.body));
    if (body.get('grant_type') === 'authorization_code') {
      if (body.get('code') !== 'good-code') return json({ error: 'invalid_grant' }, { status: 400 });
      return json({ access_token: 'at-1', expires_in: 3600, refresh_token: 'rt-1', scope: 'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly', id_token: idToken });
    }
    if (refreshFails) return json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, { status: 400 });
    return json({ access_token: 'at-2', expires_in: 3600 });
  }
  if (url.origin === 'https://www.googleapis.com') {
    if (url.pathname.endsWith('/calendarList')) return json({ items: [{ id: 'primary', summary: 'friend@gmail.com', primary: true }] });
    if (url.pathname.endsWith('/events')) return json({ items: [{ id: 'ev1', summary: 'Dentist', start: { dateTime: inDays(3) }, end: { dateTime: inDays(3) } }] });
  }
  if (url.origin === 'https://gmail.googleapis.com') {
    if (url.pathname.endsWith('/messages')) return json({ messages: [{ id: 'g1' }, { id: 'g2' }] });
    const sent = String(Date.now() - 3600_000);
    if (url.pathname.endsWith('/g1')) return json({ id: 'g1', internalDate: sent, labelIds: ['INBOX'], snippet: 'Looking forward to it', payload: { headers: [{ name: 'Subject', value: 'Interview tomorrow at 3pm' }, { name: 'From', value: 'Acme <jobs@acme.com>' }] } });
    if (url.pathname.endsWith('/g2')) return json({ id: 'g2', internalDate: sent, labelIds: ['INBOX'], snippet: 'hey', payload: { headers: [{ name: 'Subject', value: 'lunch?' }, { name: 'From', value: 'Pal <pal@x.com>' }] } });
  }
  return null;
};

async function waitFor<T>(fn: () => Promise<T | null | undefined>, ms = 3000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 50));
  }
}

describe('Google', () => {
  beforeEach(() => { refreshFails = false; });

  it('start hands back a Google consent URL', async () => {
    const u = await createUser();
    const res = await api(app, u.token).post('/integrations/google/start', { return: 'setup' });
    expect(res.status).toBe(200);
    expect(new URL(res.body.url).origin).toBe('https://accounts.google.com');
  });

  it('the callback stores the account and the first sync imports calendar events and dated emails', async () => {
    const calls = stubFetch(googleRoutes);
    const u = await createUser();
    const state = signOAuthState({ user_id: u.id, provider: 'google', ret: 'setup' });
    const res = await request(app).get(`/integrations/google/callback?code=good-code&state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/setup#google=connected');

    const synced = await waitFor(async () => (await query('SELECT * FROM integrations WHERE user_id = $1 AND last_synced_at IS NOT NULL', [u.id])).rows[0]);
    expect(synced).toMatchObject({ provider: 'google', account: 'friend@gmail.com', status: 'active', last_status: 'ok' });
    expect(synced.secret_enc).not.toContain('rt-1');
    expect(typeof synced.cursor.gmail_after).toBe('number');

    const titles = (await query('SELECT title, source FROM obligations WHERE user_id = $1 ORDER BY title', [u.id])).rows;
    expect(titles.map(r => r.title)).toEqual(['Dentist', 'Interview tomorrow at 3pm']);
    expect(titles.map(r => r.source.split(':')[0])).toEqual(['google_calendar', 'gmail']);
    expect(calls.some(c => c.includes('/messages/g1'))).toBe(true);
  });

  it('an expired refresh token marks the account for reconnecting, and the scheduler stops retrying it', async () => {
    stubFetch(googleRoutes);
    const u = await createUser();
    const state = signOAuthState({ user_id: u.id, provider: 'google', ret: 'app' });
    const res = await request(app).get(`/integrations/google/callback?code=good-code&state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('friend@gmail.com');
    await waitFor(async () => (await query('SELECT 1 FROM integrations WHERE last_synced_at IS NOT NULL')).rows[0]);

    // the access token has run out and Google has revoked the refresh token
    await query("UPDATE integrations SET access_expires_at = NOW() - INTERVAL '1 minute', last_synced_at = NOW() - INTERVAL '2 hours'");
    refreshFails = true;
    await sweepOnce();
    const row = (await query('SELECT status, last_error FROM integrations WHERE user_id = $1', [u.id])).rows[0]!;
    expect(row.status).toBe('needs_reauth');
    expect(row.last_error).toMatch(/Reconnect Google/);
    const list = await api(app, u.token).get('/integrations');
    expect(list.body.integrations[0].status).toBe('needs_reauth');
  });

  it('a forged or expired state is refused', async () => {
    stubFetch(googleRoutes);
    const res = await request(app).get('/integrations/google/callback?code=good-code&state=nope');
    expect(res.status).toBe(400);
    expect((await query('SELECT COUNT(*)::int AS n FROM integrations')).rows[0]!.n).toBe(0);
  });

  it('disconnecting revokes the token and keeps what was imported', async () => {
    const calls = stubFetch(googleRoutes);
    const u = await createUser();
    const state = signOAuthState({ user_id: u.id, provider: 'google', ret: 'app' });
    await request(app).get(`/integrations/google/callback?code=good-code&state=${encodeURIComponent(state)}`);
    await waitFor(async () => (await query('SELECT 1 FROM integrations WHERE last_synced_at IS NOT NULL')).rows[0]);
    const del = await api(app, u.token).delete('/integrations/google');
    expect(del.status).toBe(204);
    expect(calls).toContain('POST https://oauth2.googleapis.com/revoke');
    expect((await query('SELECT COUNT(*)::int AS n FROM obligations WHERE user_id = $1', [u.id])).rows[0]!.n).toBe(2);
  });
});

describe('setup page', () => {
  it('serves the page and its assets', async () => {
    const page = await request(app).get('/setup');
    expect(page.status).toBe(200);
    expect(page.text).toContain('/setup/setup.js');
    expect((await request(app).get('/setup/setup.js')).status).toBe(200);
    expect((await request(app).get('/setup/../package.json')).status).toBe(404);
    expect((await request(app).get('/')).headers.location).toBe('/setup');
  });
});
