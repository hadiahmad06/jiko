// src/services/integrations/store.ts
//
// The integrations table. Rows hold sealed credentials; `toPublic` is the only
// shape that leaves the server.
import { z } from 'zod';
import { query } from '../../db/psqlClient.js';

export const IntegrationProvider = z.enum(['google', 'canvas']);
export type IntegrationProviderT = z.infer<typeof IntegrationProvider>;

export const Integration = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  provider: IntegrationProvider,
  account: z.string().nullable(),
  base_url: z.string().nullable(),
  scopes: z.array(z.string()),
  secret_enc: z.string(),
  access_token_enc: z.string().nullable(),
  access_expires_at: z.coerce.date().nullable(),
  status: z.enum(['active', 'needs_reauth', 'error']),
  enabled: z.boolean(),
  refresh_minutes: z.number().int(),
  cursor: z.record(z.string(), z.unknown()),
  last_synced_at: z.coerce.date().nullable(),
  last_status: z.string().nullable(),
  last_error: z.string().nullable(),
  last_created: z.number().int(),
  last_updated: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});
export type IntegrationT = z.infer<typeof Integration>;

export function toPublic(i: IntegrationT) {
  return {
    provider: i.provider,
    account: i.account,
    base_url: i.base_url,
    scopes: i.scopes,
    status: i.status,
    enabled: i.enabled,
    last_synced_at: i.last_synced_at,
    last_status: i.last_status,
    last_error: i.last_error,
    last_created: i.last_created,
    last_updated: i.last_updated,
    connected_at: i.created_at,
  };
}

export interface ConnectInput {
  account: string | null;
  base_url?: string | null;
  scopes?: string[];
  secret_enc: string;
  access_token_enc?: string | null;
  access_expires_at?: Date | null;
  refresh_minutes?: number;
}

class IntegrationRepository {
  async list(user_id: string): Promise<IntegrationT[]> {
    const res = await query('SELECT * FROM integrations WHERE user_id = $1 ORDER BY provider', [user_id]);
    return res.rows.map(r => Integration.parse(r));
  }

  async get(user_id: string, provider: IntegrationProviderT): Promise<IntegrationT | null> {
    const res = await query('SELECT * FROM integrations WHERE user_id = $1 AND provider = $2', [user_id, provider]);
    return res.rows[0] ? Integration.parse(res.rows[0]) : null;
  }

  /** Connecting again replaces the credentials and clears any error. */
  async connect(user_id: string, provider: IntegrationProviderT, c: ConnectInput): Promise<IntegrationT> {
    const res = await query(
      `INSERT INTO integrations (user_id, provider, account, base_url, scopes, secret_enc, access_token_enc, access_expires_at, refresh_minutes)
       VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8::timestamptz, $9::int)
       ON CONFLICT (user_id, provider) DO UPDATE SET
         account = EXCLUDED.account, base_url = EXCLUDED.base_url, scopes = EXCLUDED.scopes,
         secret_enc = EXCLUDED.secret_enc, access_token_enc = EXCLUDED.access_token_enc,
         access_expires_at = EXCLUDED.access_expires_at, refresh_minutes = EXCLUDED.refresh_minutes,
         status = 'active', enabled = TRUE, last_error = NULL,
         cursor = CASE WHEN integrations.account IS DISTINCT FROM EXCLUDED.account THEN '{}'::jsonb ELSE integrations.cursor END
       RETURNING *`,
      [user_id, provider, c.account, c.base_url ?? null, c.scopes ?? [], c.secret_enc, c.access_token_enc ?? null, c.access_expires_at ?? null, c.refresh_minutes ?? 30]
    );
    return Integration.parse(res.rows[0]);
  }

  async setAccess(id: string, access_token_enc: string, expires_at: Date) {
    await query('UPDATE integrations SET access_token_enc = $2, access_expires_at = $3::timestamptz WHERE id = $1', [id, access_token_enc, expires_at]);
  }

  async markNeedsReauth(id: string, error: string, now = new Date()) {
    await query(
      `UPDATE integrations SET status = 'needs_reauth', access_token_enc = NULL, access_expires_at = NULL,
         last_synced_at = $3::timestamptz, last_status = 'error', last_error = $2 WHERE id = $1`,
      [id, error.slice(0, 500), now]
    );
  }

  async recordRun(id: string, o: { status: 'ok' | 'partial' | 'error'; error?: string | null; created?: number; updated?: number; cursor?: Record<string, unknown> }, now = new Date()) {
    await query(
      `UPDATE integrations SET last_synced_at = $2::timestamptz, last_status = $3, last_error = $4,
         last_created = $5::int, last_updated = $6::int, cursor = COALESCE($7::jsonb, cursor)
       WHERE id = $1`,
      [id, now, o.status, o.error ? o.error.slice(0, 500) : null, o.created ?? 0, o.updated ?? 0, o.cursor ? JSON.stringify(o.cursor) : null]
    );
  }

  async delete(user_id: string, provider: IntegrationProviderT): Promise<IntegrationT | null> {
    const res = await query('DELETE FROM integrations WHERE user_id = $1 AND provider = $2 RETURNING *', [user_id, provider]);
    return res.rows[0] ? Integration.parse(res.rows[0]) : null;
  }

  /** Active rows whose refresh period has elapsed, or that never synced. */
  async dueForSync(now: Date, limit = 20): Promise<IntegrationT[]> {
    const res = await query(
      `SELECT * FROM integrations
       WHERE enabled AND status <> 'needs_reauth'
         AND (last_synced_at IS NULL OR last_synced_at <= $1::timestamptz - make_interval(mins => refresh_minutes))
       ORDER BY last_synced_at ASC NULLS FIRST
       LIMIT $2::int`,
      [now, limit]
    );
    return res.rows.map(r => Integration.parse(r));
  }
}

export const Integrations = new IntegrationRepository();
