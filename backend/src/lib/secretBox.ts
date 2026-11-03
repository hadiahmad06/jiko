// src/lib/secretBox.ts
//
// AES-256-GCM for credentials at rest (OAuth refresh tokens, Canvas tokens).
// The key lives in JIKO_TOKEN_KEY, outside the database, so a leaked dump or
// backup does not leak access to anyone's mail. Format: "v1:" + base64(iv|tag|ciphertext).
import crypto from 'crypto';

function key(): Buffer {
  const raw = process.env.JIKO_TOKEN_KEY;
  if (!raw) throw new Error('JIKO_TOKEN_KEY is not set');
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('JIKO_TOKEN_KEY must be 32 bytes: 64 hex characters or base64');
  return buf;
}

export function tokenKeyConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return 'v1:' + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function unseal(sealed: string): string {
  if (!sealed.startsWith('v1:')) throw new Error('unknown sealed format');
  const raw = Buffer.from(sealed.slice(3), 'base64');
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export const sealJson = (v: unknown) => seal(JSON.stringify(v));
export const unsealJson = <T>(s: string): T => JSON.parse(unseal(s)) as T;
