// src/lib/jwt.ts
//
// Single source of truth for token shape. Every token Jiko issues carries
// `{ user_id }` and nothing else. Access tokens are verified only here and in
// the auth middleware; routes never call jsonwebtoken directly.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface JikoJwtPayload {
  user_id: string;
}

export const ACCESS_TOKEN_TTL = '1d';
export const REFRESH_TOKEN_TTL = '7d';

function accessSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

function refreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
  return s;
}

export function secretsConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET);
}

export function signAccessToken(user_id: string): string {
  return jwt.sign({ user_id } satisfies JikoJwtPayload, accessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(user_id: string): string {
  return jwt.sign({ user_id } satisfies JikoJwtPayload, refreshSecret(), { expiresIn: REFRESH_TOKEN_TTL });
}

export function issueTokenPair(user_id: string): { token: string; refreshToken: string } {
  return { token: signAccessToken(user_id), refreshToken: signRefreshToken(user_id) };
}

function extractUserId(decoded: unknown): string | null {
  if (typeof decoded !== 'object' || decoded === null) return null;
  const d = decoded as Record<string, unknown>;
  const id = d.user_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Returns the user_id or null. Never throws. */
export function verifyAccessToken(token: string): string | null {
  try {
    return extractUserId(jwt.verify(token, accessSecret()));
  } catch {
    return null;
  }
}

/** Returns the user_id or null. Never throws. */
export function verifyRefreshToken(token: string): string | null {
  try {
    return extractUserId(jwt.verify(token, refreshSecret()));
  } catch {
    return null;
  }
}

/** Pulls the bearer token out of an Authorization header value. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * OAuth `state`: who started a "Connect Google" and where to send them back.
 * It travels through the browser and Google's logs, so it is signed with a key
 * derived from (not equal to) the access-token secret: a leaked state is not a
 * usable access token, because verifyAccessToken would reject its signature.
 */
export interface OAuthState { user_id: string; provider: 'google'; ret: 'setup' | 'app' }

function stateSecret(): string {
  return crypto.createHmac('sha256', accessSecret()).update('jiko-oauth-state').digest('hex');
}

export function signOAuthState(s: OAuthState): string {
  return jwt.sign({ ...s, purpose: 'oauth_state' }, stateSecret(), { expiresIn: '15m' });
}

export function verifyOAuthState(token: string): OAuthState | null {
  try {
    const d = jwt.verify(token, stateSecret()) as Record<string, unknown>;
    if (d.purpose !== 'oauth_state' || typeof d.user_id !== 'string' || d.provider !== 'google') return null;
    return { user_id: d.user_id, provider: 'google', ret: d.ret === 'setup' ? 'setup' : 'app' };
  } catch {
    return null;
  }
}
