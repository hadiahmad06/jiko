// src/middleware/rateLimit.ts
//
// Per-user (or per-IP when unauthenticated) request limits. Sync endpoints are
// chatty by design, so they get a generous bucket; auth endpoints are the ones
// worth being mean about. Disabled under test and when JIKO_RATE_LIMIT=off.
import { Request, RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { bearerToken, verifyAccessToken } from '../lib/jwt.js';

export const rateLimitDisabled = () =>
  process.env.NODE_ENV === 'test' || process.env.JIKO_RATE_LIMIT === 'off';

/** The authenticated user when there is one, otherwise the (IPv6-safe) client IP. */
function keyFor(req: Request): string {
  const header = req.headers['authorization'];
  if (header) {
    const token = bearerToken(header);
    const user_id = token ? verifyAccessToken(token) : null;
    if (user_id) return `u:${user_id}`;
  }
  return `ip:${ipKeyGenerator(req.ip ?? '0.0.0.0')}`;
}

function limiter(opts: { windowMs: number; max: number; name: string }): RequestHandler {
  const handler = rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyFor,
    message: { error: 'RateLimited', message: 'Too many requests. Slow down.' },
    skip: rateLimitDisabled,
  });
  Object.defineProperty(handler, 'name', { value: `rateLimit:${opts.name}` });
  return handler;
}

const num = (env: string | undefined, fallback: number) => {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Devices push app usage / health / location on a timer; allow a burst. */
export const syncLimiter = limiter({
  name: 'sync',
  windowMs: 60_000,
  max: num(process.env.JIKO_RATE_LIMIT_SYNC, 120),
});

/** Talk-back is human-paced. */
export const messagesLimiter = limiter({
  name: 'messages',
  windowMs: 60_000,
  max: num(process.env.JIKO_RATE_LIMIT_MESSAGES, 60),
});

/** Login / signup / OTP: per IP, slow. */
export const authLimiter = limiter({
  name: 'auth',
  windowMs: 15 * 60_000,
  max: num(process.env.JIKO_RATE_LIMIT_AUTH, 20),
});

/** Everything else. */
export const globalLimiter = limiter({
  name: 'global',
  windowMs: 60_000,
  max: num(process.env.JIKO_RATE_LIMIT_GLOBAL, 300),
});
