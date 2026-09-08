// src/lib/jwt.ts
//
// Single source of truth for token shape. Every token Jiko issues carries
// `{ user_id }` and nothing else. Access tokens are verified only here and in
// the auth middleware; routes never call jsonwebtoken directly.
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
