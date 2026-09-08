import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { issueTokenPair, verifyAccessToken, verifyRefreshToken, bearerToken, signAccessToken } from '../../../lib/jwt.js';

beforeAll(() => { process.env.JWT_SECRET = 'a'; process.env.JWT_REFRESH_SECRET = 'b'; });

describe('jwt', () => {
  it('round-trips user_id and keeps access/refresh secrets separate', () => {
    const { token, refreshToken } = issueTokenPair('u1');
    expect(verifyAccessToken(token)).toBe('u1');
    expect(verifyRefreshToken(refreshToken)).toBe('u1');
    expect(verifyAccessToken(refreshToken)).toBeNull();
    expect(verifyRefreshToken(token)).toBeNull();
  });
  it('rejects legacy userId payloads and garbage', () => {
    expect(verifyAccessToken(jwt.sign({ userId: 'u1' }, 'a'))).toBeNull();
    expect(verifyAccessToken('nope')).toBeNull();
  });
  it('bearerToken parsing', () => {
    expect(bearerToken(`Bearer ${signAccessToken('x')}`)).not.toBeNull();
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});
