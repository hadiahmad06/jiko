import request from 'supertest';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import createApp from '../../../app';

describe('payload caps', () => {
  let app: any;
  beforeAll(async () => { app = await createApp(); });

  it('rejects an oversized body with 413', async () => {
    const res = await request(app)
      .post('/messages')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ body: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('PayloadTooLarge');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/messages')
      .set('content-type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('InvalidBody');
  });

  it('allows a sync-sized body through to auth', async () => {
    const res = await request(app)
      .post('/sync/app-usage')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ log: new Array(2000).fill({ bundleId: 'com.example', appName: 'Example', durationSeconds: 1, timestamp: new Date().toISOString() }) }));
    // no token: it got past the parser and was rejected by auth, not by size
    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  // The exported limiters skip under NODE_ENV=test; this covers the wiring
  // (key derivation + 429 shape) with the same options on a throwaway app.
  it('429s after the limit, keyed per client', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(rateLimit({
      windowMs: 60_000,
      limit: 2,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? '0.0.0.0')}`,
      message: { error: 'RateLimited', message: 'Too many requests. Slow down.' },
    }));
    app.get('/ping', (_req, res) => { res.json({ ok: true }); });

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    const third = await request(app).get('/ping');
    expect(third.status).toBe(429);
    expect(third.body.error).toBe('RateLimited');
  });
});
