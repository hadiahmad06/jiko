// src/services/calendars.ts
//
// Stored ICS subscriptions: fetch a user-supplied calendar URL, turn the events
// into obligations, and record what happened. The fetch is the one place the
// server follows a URL a user typed, so it is deliberately narrow: https (or
// http when explicitly allowed), no private hosts, a size cap and a timeout.
import { z } from 'zod';
import { query } from '../db/psqlClient.js';
import { icsToObligations } from './ics.js';
import ObligationRepository from './repositories/ObligationRepository.js';

export const CalendarSubscription = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  url: z.string(),
  name: z.string().nullable(),
  enabled: z.boolean(),
  window_days: z.number().int(),
  refresh_hours: z.number().int(),
  last_imported_at: z.coerce.date().nullable(),
  last_status: z.string().nullable(),
  last_error: z.string().nullable(),
  last_created: z.number().int(),
  last_updated: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});
export type CalendarSubscriptionT = z.infer<typeof CalendarSubscription>;

export const CalendarSubscriptionCreate = z.object({
  url: z.string().min(8).max(2000),
  name: z.string().max(120).optional(),
  window_days: z.number().int().min(1).max(365).default(30),
  refresh_hours: z.number().int().min(1).max(168).default(24),
});
export type CalendarSubscriptionCreateT = z.infer<typeof CalendarSubscriptionCreate>;

export const CalendarSubscriptionUpdate = z.object({
  name: z.string().max(120).nullable().optional(),
  enabled: z.boolean().optional(),
  window_days: z.number().int().min(1).max(365).optional(),
  refresh_hours: z.number().int().min(1).max(168).optional(),
}).strict();
export type CalendarSubscriptionUpdateT = z.infer<typeof CalendarSubscriptionUpdate>;

const MAX_BYTES = Number(process.env.JIKO_ICS_MAX_BYTES || 5 * 1024 * 1024);
const TIMEOUT_MS = Number(process.env.JIKO_ICS_TIMEOUT_MS || 15_000);

/** webcal:// is an https URL wearing a hat. */
export function normalizeIcsUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  let candidate = raw.trim();
  if (/^webcal:\/\//i.test(candidate)) candidate = candidate.replace(/^webcal:\/\//i, 'https://');
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { return { ok: false, reason: 'That is not a URL.' }; }

  const allowHttp = process.env.JIKO_ICS_ALLOW_HTTP === 'true';
  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    return { ok: false, reason: 'Calendar URLs must be https (or webcal).' };
  }
  if (isPrivateHost(parsed.hostname) && process.env.JIKO_ICS_ALLOW_PRIVATE !== 'true') {
    return { ok: false, reason: 'That host is not reachable from the server.' };
  }
  return { ok: true, url: parsed.toString() };
}

/** Literal loopback / link-local / RFC1918 targets. Keeps the fetch off the LAN. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '0.0.0.0') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;         // unique local IPv6
  if (/^fe80:/.test(h)) return true;                      // link-local IPv6
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export interface FetchedCalendar { text: string }

export async function fetchIcs(url: string): Promise<FetchedCalendar> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5' } });
    if (!res.ok) throw new Error(`calendar returned ${res.status}`);
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('calendar is too large');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('calendar is too large');
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('that URL did not return a calendar');
    return { text };
  } finally {
    clearTimeout(timer);
  }
}

class CalendarRepository {
  async list(user_id: string): Promise<CalendarSubscriptionT[]> {
    const res = await query('SELECT * FROM calendar_subscriptions WHERE user_id = $1 ORDER BY created_at ASC', [user_id]);
    return res.rows.map(r => CalendarSubscription.parse(r));
  }

  async get(id: string, user_id: string): Promise<CalendarSubscriptionT | null> {
    const res = await query('SELECT * FROM calendar_subscriptions WHERE id = $1 AND user_id = $2', [id, user_id]);
    return res.rows[0] ? CalendarSubscription.parse(res.rows[0]) : null;
  }

  /** Re-adding the same URL updates the existing row instead of erroring. */
  async create(user_id: string, data: CalendarSubscriptionCreateT & { url: string }): Promise<CalendarSubscriptionT> {
    const res = await query(
      `INSERT INTO calendar_subscriptions (user_id, url, name, window_days, refresh_hours)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, url) DO UPDATE
         SET name = EXCLUDED.name, window_days = EXCLUDED.window_days, refresh_hours = EXCLUDED.refresh_hours, enabled = TRUE
       RETURNING *`,
      [user_id, data.url, data.name ?? null, data.window_days, data.refresh_hours]
    );
    return CalendarSubscription.parse(res.rows[0]);
  }

  async update(id: string, user_id: string, data: CalendarSubscriptionUpdateT): Promise<CalendarSubscriptionT | null> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.get(id, user_id);
    const sets = entries.map(([k], i) => `${k} = $${i + 3}`).join(', ');
    const res = await query(`UPDATE calendar_subscriptions SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`, [id, user_id, ...entries.map(([, v]) => v)]);
    return res.rows[0] ? CalendarSubscription.parse(res.rows[0]) : null;
  }

  async delete(id: string, user_id: string): Promise<boolean> {
    const res = await query('DELETE FROM calendar_subscriptions WHERE id = $1 AND user_id = $2', [id, user_id]);
    return (res.rowCount ?? 0) > 0;
  }

  /** Subscriptions whose refresh window has elapsed (or that never ran). */
  async dueForRefresh(now: Date, limit = 20): Promise<CalendarSubscriptionT[]> {
    const res = await query(
      `SELECT * FROM calendar_subscriptions
       WHERE enabled
         AND (last_imported_at IS NULL OR last_imported_at <= $1 - make_interval(hours => refresh_hours))
       ORDER BY last_imported_at ASC NULLS FIRST
       LIMIT $2`,
      [now, limit]
    );
    return res.rows.map(r => CalendarSubscription.parse(r));
  }

  async recordRun(id: string, outcome: { status: 'ok' | 'error'; error?: string; created?: number; updated?: number }, now = new Date()) {
    await query(
      `UPDATE calendar_subscriptions
       SET last_imported_at = $2, last_status = $3, last_error = $4, last_created = $5, last_updated = $6
       WHERE id = $1`,
      [id, now, outcome.status, outcome.error ?? null, outcome.created ?? 0, outcome.updated ?? 0]
    );
  }
}

export const Calendars = new CalendarRepository();

export interface ImportResult {
  subscription_id: string;
  status: 'ok' | 'error';
  parsed?: number;
  created?: number;
  updated?: number;
  error?: string;
}

/** Fetch one subscription and merge it into obligations. Never throws. */
export async function importSubscription(sub: CalendarSubscriptionT, now = new Date()): Promise<ImportResult> {
  try {
    const { text } = await fetchIcs(sub.url);
    const items = icsToObligations(text, {
      from: new Date(now.getTime() - 24 * 3600_000),
      to: new Date(now.getTime() + sub.window_days * 86_400_000),
      source: `ics:${sub.id}`,
    });
    const counts = await ObligationRepository.upsertExternal(sub.user_id, items);
    await Calendars.recordRun(sub.id, { status: 'ok', ...counts }, now);
    return { subscription_id: sub.id, status: 'ok', parsed: items.length, ...counts };
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    await Calendars.recordRun(sub.id, { status: 'error', error: message }, now);
    return { subscription_id: sub.id, status: 'error', error: message };
  }
}

/** Called by the scheduler; imports every subscription whose window elapsed. */
export async function refreshDueCalendars(now = new Date()): Promise<ImportResult[]> {
  const due = await Calendars.dueForRefresh(now);
  const out: ImportResult[] = [];
  for (const sub of due) out.push(await importSubscription(sub, now));
  return out;
}
