// src/services/integrations/index.ts
//
// Sync one connected account into obligations. Called right after connecting,
// from POST /integrations/:provider/sync, and by the scheduler sweep. Never
// throws: the outcome is recorded on the row and returned.
import ObligationRepository from '../repositories/ObligationRepository.js';
import PreferencesRepository from '../repositories/PreferencesRepository.js';
import { sealJson, unsealJson } from '../../lib/secretBox.js';
import { log } from '../../lib/log.js';
import { IntegrationAuthError, IntegrationHttpError } from './http.js';
import { Integrations, IntegrationT } from './store.js';
import * as google from './google.js';
import * as canvas from './canvas.js';
import { extractFromEmail } from './gmailExtract.js';

export interface SyncResult {
  provider: IntegrationT['provider'];
  status: 'ok' | 'partial' | 'error' | 'needs_reauth';
  created: number;
  updated: number;
  completed?: number;
  error?: string;
  detail?: Record<string, number>;
}

const WINDOW_DAYS = Number(process.env.JIKO_INTEGRATION_WINDOW_DAYS || 30);
const GMAIL_FIRST_LOOKBACK_DAYS = 7;

async function googleAccess(row: IntegrationT, now: Date): Promise<string> {
  if (row.access_token_enc && row.access_expires_at && row.access_expires_at.getTime() > now.getTime()) {
    return unsealJson<{ access_token: string }>(row.access_token_enc).access_token;
  }
  const { refresh_token } = unsealJson<{ refresh_token: string }>(row.secret_enc);
  const fresh = await google.refreshAccessToken(refresh_token);
  await Integrations.setAccess(row.id, sealJson({ access_token: fresh.access_token }), fresh.expires_at);
  return fresh.access_token;
}

async function syncGoogle(row: IntegrationT, now: Date): Promise<SyncResult> {
  const token = await googleAccess(row, now);
  const errors: string[] = [];
  let created = 0, updated = 0;
  const detail: Record<string, number> = {};
  const cursor = { ...row.cursor };

  if (row.scopes.includes(google.SCOPE_CALENDAR)) {
    try {
      const events = await google.fetchCalendarEvents(token, new Date(now.getTime() - 86_400_000), new Date(now.getTime() + WINDOW_DAYS * 86_400_000));
      const items = google.mapCalendarEvents(events, `google_calendar:${row.id}`);
      const c = await ObligationRepository.upsertExternal(row.user_id, items);
      created += c.created; updated += c.updated; detail.calendar_events = items.length;
    } catch (err) {
      if (err instanceof IntegrationAuthError) throw err;
      errors.push(`calendar: ${(err as Error).message}`);
    }
  }

  if (row.scopes.includes(google.SCOPE_GMAIL)) {
    try {
      const prefs = await PreferencesRepository.get(row.user_id);
      const after = typeof cursor.gmail_after === 'number' ? cursor.gmail_after : Math.floor(now.getTime() / 1000) - GMAIL_FIRST_LOOKBACK_DAYS * 86_400;
      const mail = await google.fetchRecentMail(token, after);
      const items = mail
        .map(m => extractFromEmail(m, { now, timezone: prefs.timezone, source: `gmail:${row.id}` }))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const c = await ObligationRepository.upsertExternal(row.user_id, items);
      created += c.created; updated += c.updated;
      detail.emails_read = mail.length; detail.emails_used = items.length;
      const newest = mail.reduce((mx, m) => Math.max(mx, Math.floor(m.internalDate / 1000)), after);
      cursor.gmail_after = newest;
    } catch (err) {
      if (err instanceof IntegrationAuthError) throw err;
      errors.push(`gmail: ${(err as Error).message}`);
    }
  }

  const status = errors.length === 0 ? 'ok' : (created + updated > 0 || Object.keys(detail).length > 0) ? 'partial' : 'error';
  await Integrations.recordRun(row.id, { status, error: errors.join('; ') || null, created, updated, cursor }, now);
  return { provider: 'google', status, created, updated, detail, ...(errors.length ? { error: errors.join('; ') } : {}) };
}

async function syncCanvas(row: IntegrationT, now: Date): Promise<SyncResult> {
  const { token } = unsealJson<{ token: string }>(row.secret_enc);
  const raw = await canvas.fetchPlannerItems(row.base_url!, token, new Date(now.getTime() - 86_400_000), new Date(now.getTime() + WINDOW_DAYS * 86_400_000));
  const items = canvas.mapPlannerItems(raw, `canvas:${row.id}`);
  const c = await ObligationRepository.upsertExternal(row.user_id, items);
  await Integrations.recordRun(row.id, { status: 'ok', created: c.created, updated: c.updated }, now);
  return { provider: 'canvas', status: 'ok', created: c.created, updated: c.updated, completed: c.completed, detail: { planner_items: raw.length } };
}

export async function syncIntegration(row: IntegrationT, now = new Date()): Promise<SyncResult> {
  try {
    const r = row.provider === 'google' ? await syncGoogle(row, now) : await syncCanvas(row, now);
    log.info('integration synced', { event: 'integration_sync', user_id: row.user_id, provider: row.provider, status: r.status, created: r.created, updated: r.updated });
    return r;
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    if (err instanceof IntegrationAuthError || (err instanceof IntegrationHttpError && err.status === 403 && row.provider === 'canvas')) {
      await Integrations.markNeedsReauth(row.id, message, now);
      log.warn('integration needs reconnect', { event: 'integration_sync', user_id: row.user_id, provider: row.provider, error: message });
      return { provider: row.provider, status: 'needs_reauth', created: 0, updated: 0, error: message };
    }
    await Integrations.recordRun(row.id, { status: 'error', error: message }, now);
    log.warn('integration sync failed', { event: 'integration_sync', user_id: row.user_id, provider: row.provider, error: message });
    return { provider: row.provider, status: 'error', created: 0, updated: 0, error: message };
  }
}

/** Scheduler entry point: every active integration whose refresh period elapsed. */
export async function refreshDueIntegrations(now = new Date()): Promise<SyncResult[]> {
  const due = await Integrations.dueForSync(now);
  const out: SyncResult[] = [];
  for (const row of due) out.push(await syncIntegration(row, now));
  return out;
}
