import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import createApp from '../../app.js';
import { resetDb } from './helpers.js';

let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp(); });
beforeEach(resetDb);

const creds = { phone_number: '+15550001111', password: 'Password123!' };

describe('auth', () => {
  it('signup -> me -> login -> refresh all share one token contract', async () => {
    const signup = await request(app).post('/auth/signup').send({ ...creds, username: 'hadi', nickname: 'H' });
    expect(signup.status).toBe(201);
    expect(signup.body.user_id).toBeDefined();

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${signup.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('hadi');
    expect(me.body).not.toHaveProperty('password_hash');

    const login = await request(app).post('/auth/login').send(creds);
    expect(login.status).toBe(200);
    expect(login.body.user_id).toBe(signup.body.user_id);

    const refreshed = await request(app).post('/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    const prefs = await request(app).get('/users/preferences').set('Authorization', `Bearer ${refreshed.body.token}`);
    expect(prefs.status).toBe(200);
    expect(prefs.body.strictness).toBe(0.5);
  });

  it('rejects duplicate phone numbers with a useful message', async () => {
    await request(app).post('/auth/signup').send(creds);
    const dup = await request(app).post('/auth/signup').send(creds);
    expect(dup.status).toBe(400);
    expect(dup.body.message).toMatch(/phone_number/);
  });

  it('rejects wrong passwords and unknown users', async () => {
    await request(app).post('/auth/signup').send(creds);
    expect((await request(app).post('/auth/login').send({ ...creds, password: 'nope' })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ phone_number: '+10000000000', password: 'x' })).status).toBe(404);
  });

  it('DELETE /users removes the account and everything under it', async () => {
    const s = await request(app).post('/auth/signup').send(creds);
    const auth = { Authorization: `Bearer ${s.body.token}` };
    await request(app).post('/obligations').set(auth).send({ title: 'x', due_at: new Date().toISOString() });
    expect((await request(app).delete('/users').set(auth)).status).toBe(204);
    expect((await request(app).get('/auth/me').set(auth)).status).toBe(404);
  });
});
