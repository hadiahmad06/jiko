import request from 'supertest';
import crypto from 'crypto';
import type { Application } from 'express';
import { query } from '../../db/psqlClient.js';
import { signAccessToken } from '../../lib/jwt.js';
import AppUsageManager from '../../data/AppUsageManager.js';
import HealthManager from '../../data/HealthManager.js';
import LocationManager from '../../data/LocationManager.js';
import { setDelivererForTests } from '../../services/messaging/delivery.js';

/** Wipes every table (schema stays) and in-memory caches. */
export async function resetDb() {
  await query('TRUNCATE users RESTART IDENTITY CASCADE');
  AppUsageManager.reset();
  HealthManager.reset();
  LocationManager.reset();
  setDelivererForTests(null);
}

export async function createUser(overrides: Partial<{ phone_number: string; nickname: string }> = {}) {
  const id = crypto.randomUUID();
  const phone = overrides.phone_number ?? `+1555${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  await query('INSERT INTO users (id, phone_number, password_hash, nickname) VALUES ($1, $2, $3, $4)', [id, phone, 'x', overrides.nickname ?? 'tester']);
  return { id, token: signAccessToken(id), phone };
}

export function api(app: Application, token: string) {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (p: string) => auth(request(app).get(p)),
    post: (p: string, body?: unknown) => auth(request(app).post(p)).send(body as object),
    put: (p: string, body?: unknown) => auth(request(app).put(p)).send(body as object),
    patch: (p: string, body?: unknown) => auth(request(app).patch(p)).send(body as object),
    delete: (p: string) => auth(request(app).delete(p)),
  };
}

export function usagePayload(bundleId: string, minutes: number, opts: { device_id?: string; appName?: string; endMinutesAgo?: number } = {}) {
  const end = new Date(Date.now() - (opts.endMinutesAgo ?? 0) * 60_000);
  const start = new Date(end.getTime() - minutes * 60_000);
  return {
    timestamp: end.toISOString(),
    platform: 'macos',
    device_id: opts.device_id ?? 'mac-1',
    log: [{ bundleId, appName: opts.appName ?? bundleId, timestamp: end.toISOString(), startTime: start.toISOString(), durationSeconds: minutes * 60, isForeground: true }],
  };
}
