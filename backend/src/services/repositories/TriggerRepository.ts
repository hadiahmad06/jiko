// src/services/repositories/TriggerRepository.ts
import { query } from '../../db/psqlClient.js';
import { Trigger, TriggerT, TriggerCreateT, TriggerKindT, TriggerFiring, TriggerFiringT } from '../../types/trigger/Trigger.js';
import { Result, notFound } from '../../types/common/common.js';

function parseRow(row: unknown): TriggerT {
  return Trigger.parse(row);
}

class TriggerRepository {
  async list(user_id: string, kind?: TriggerKindT): Promise<TriggerT[]> {
    const res = kind
      ? await query('SELECT * FROM triggers WHERE user_id = $1 AND kind = $2 ORDER BY created_at DESC', [user_id, kind])
      : await query('SELECT * FROM triggers WHERE user_id = $1 ORDER BY created_at DESC', [user_id]);
    return res.rows.map(parseRow);
  }

  async listEnabled(user_id: string, kind: TriggerKindT): Promise<TriggerT[]> {
    const res = await query('SELECT * FROM triggers WHERE user_id = $1 AND kind = $2 AND enabled', [user_id, kind]);
    return res.rows.map(parseRow);
  }

  async get(id: string, user_id: string): Promise<Result<TriggerT>> {
    const res = await query('SELECT * FROM triggers WHERE id = $1 AND user_id = $2', [id, user_id]);
    if (!res.rows[0]) return notFound('Trigger not found');
    return { success: true, value: parseRow(res.rows[0]) };
  }

  async create(user_id: string, data: TriggerCreateT, next_run_at: Date | null = null): Promise<TriggerT> {
    const t = Trigger.parse({ user_id, ...data, next_run_at });
    const res = await query(
      `INSERT INTO triggers (id, user_id, kind, name, enabled, match, condition, actions, cooldown_seconds, next_run_at, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [t.id, t.user_id, t.kind, t.name, t.enabled, JSON.stringify(t.match), JSON.stringify(t.condition), JSON.stringify(t.actions), t.cooldown_seconds, t.next_run_at ?? null, t.source]
    );
    return parseRow(res.rows[0]);
  }

  /** Generic partial update. JSON columns are stringified; caller has validated. */
  async update(id: string, user_id: string, fields: Record<string, unknown>): Promise<Result<TriggerT>> {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return { success: false, code: 400, details: { error: 'BadRequest', message: 'No fields to update' } };
    const json = new Set(['match', 'condition', 'actions']);
    const sets = entries.map(([k], i) => `${k} = $${i + 3}`).join(', ');
    const values = entries.map(([k, v]) => (json.has(k) ? JSON.stringify(v) : v));
    const res = await query(`UPDATE triggers SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`, [id, user_id, ...values]);
    if (!res.rows[0]) return notFound('Trigger not found');
    return { success: true, value: parseRow(res.rows[0]) };
  }

  async delete(id: string, user_id: string): Promise<boolean> {
    const res = await query('DELETE FROM triggers WHERE id = $1 AND user_id = $2', [id, user_id]);
    return (res.rowCount ?? 0) > 0;
  }

  /** Scheduled triggers whose next_run_at has passed, across all users. */
  async dueScheduled(now: Date, limit = 200): Promise<TriggerT[]> {
    const res = await query(
      `SELECT * FROM triggers WHERE enabled AND kind = 'scheduled' AND next_run_at IS NOT NULL AND next_run_at <= $1
       ORDER BY next_run_at ASC LIMIT $2`,
      [now, limit]
    );
    return res.rows.map(parseRow);
  }

  /** Obligation triggers for every user, used by the scheduler sweep. */
  async allEnabledOfKind(kind: TriggerKindT): Promise<TriggerT[]> {
    const res = await query('SELECT * FROM triggers WHERE enabled AND kind = $1', [kind]);
    return res.rows.map(parseRow);
  }

  async recordFiring(trigger_id: string, user_id: string, context: unknown, results: unknown, next_run_at?: Date | null): Promise<TriggerFiringT> {
    const res = await query(
      `INSERT INTO trigger_firings (trigger_id, user_id, context, results) VALUES ($1, $2, $3, $4) RETURNING *`,
      [trigger_id, user_id, JSON.stringify(context ?? {}), JSON.stringify(results ?? [])]
    );
    await query(
      `UPDATE triggers SET last_fired_at = NOW(), fire_count = fire_count + 1 ${next_run_at !== undefined ? ', next_run_at = $2' : ''} WHERE id = $1`,
      next_run_at !== undefined ? [trigger_id, next_run_at] : [trigger_id]
    );
    return TriggerFiring.parse(res.rows[0]);
  }

  async firings(trigger_id: string, user_id: string, limit = 50): Promise<TriggerFiringT[]> {
    const res = await query(
      'SELECT * FROM trigger_firings WHERE trigger_id = $1 AND user_id = $2 ORDER BY fired_at DESC LIMIT $3',
      [trigger_id, user_id, limit]
    );
    return res.rows.map(r => TriggerFiring.parse(r));
  }

  async firingsSince(trigger_id: string, since: Date): Promise<number> {
    const res = await query<{ n: string }>('SELECT COUNT(*)::int AS n FROM trigger_firings WHERE trigger_id = $1 AND fired_at >= $2', [trigger_id, since]);
    return Number(res.rows[0]?.n ?? 0);
  }

  async recentFiringsForUser(user_id: string, limit = 50): Promise<TriggerFiringT[]> {
    const res = await query('SELECT * FROM trigger_firings WHERE user_id = $1 ORDER BY fired_at DESC LIMIT $2', [user_id, limit]);
    return res.rows.map(r => TriggerFiring.parse(r));
  }
}

export default new TriggerRepository();
