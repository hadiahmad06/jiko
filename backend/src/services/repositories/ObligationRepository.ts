// src/services/repositories/ObligationRepository.ts
import { query } from '../../db/psqlClient.js';
import { Obligation, ObligationT, ObligationCreateT, ObligationUpdateT, ObligationQueryT, ObligationKindT } from '../../types/obligation/Obligation.js';
import { Result, notFound } from '../../types/common/common.js';

class ObligationRepository {
  async list(user_id: string, q: ObligationQueryT): Promise<ObligationT[]> {
    const conds = ['user_id = $1', 'archived = $2'];
    const vals: unknown[] = [user_id, q.archived];
    if (q.kind) { vals.push(q.kind); conds.push(`kind = $${vals.length}`); }
    if (q.completed !== undefined) { vals.push(q.completed); conds.push(`completed = $${vals.length}`); }
    if (q.due_before) { vals.push(q.due_before); conds.push(`COALESCE(due_at, start_at) <= $${vals.length}`); }
    if (q.due_after) { vals.push(q.due_after); conds.push(`COALESCE(due_at, start_at) >= $${vals.length}`); }
    vals.push(q.limit);
    const res = await query(
      `SELECT * FROM obligations WHERE ${conds.join(' AND ')} ORDER BY COALESCE(due_at, start_at) ASC NULLS LAST, created_at DESC LIMIT $${vals.length}`,
      vals
    );
    return res.rows.map(r => Obligation.parse(r));
  }

  /** Open goal rows (kind = goal). Goals never "come due"; they accumulate. */
  async openGoals(user_id: string, activity_id?: string): Promise<ObligationT[]> {
    const res = activity_id
      ? await query(`SELECT * FROM obligations WHERE user_id = $1 AND kind = 'goal' AND NOT completed AND NOT archived AND activity_id = $2 ORDER BY created_at ASC`, [user_id, activity_id])
      : await query(`SELECT * FROM obligations WHERE user_id = $1 AND kind = 'goal' AND NOT completed AND NOT archived ORDER BY created_at ASC`, [user_id]);
    return res.rows.map(r => Obligation.parse(r));
  }

  async get(id: string, user_id: string): Promise<Result<ObligationT>> {
    const res = await query('SELECT * FROM obligations WHERE id = $1 AND user_id = $2', [id, user_id]);
    if (!res.rows[0]) return notFound('Obligation not found');
    return { success: true, value: Obligation.parse(res.rows[0]) };
  }

  async create(user_id: string, data: ObligationCreateT): Promise<Result<ObligationT>> {
    const parsed = Obligation.safeParse({ user_id, ...data });
    if (!parsed.success) return { success: false, code: 400, details: { error: 'InvalidBody', message: parsed.error.issues.map(i => i.message).join('; ') } };
    const o = parsed.data;
    const res = await query(
      `INSERT INTO obligations (id, user_id, kind, title, description, due_at, start_at, end_at, all_day, location_id, activity_id,
                                target_minutes, timeframe_days, intervention_level, source, external_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [o.id, o.user_id, o.kind, o.title, o.description ?? null, o.due_at ?? null, o.start_at ?? null, o.end_at ?? null, o.all_day,
       o.location_id ?? null, o.activity_id ?? null, o.target_minutes ?? null, o.timeframe_days ?? null, o.intervention_level, o.source, o.external_ref ?? null]
    );
    return { success: true, value: Obligation.parse(res.rows[0]) };
  }

  /** Create-or-update keyed on (user_id, source, external_ref). Returns [created, updated] counts. */
  async upsertExternal(user_id: string, items: Array<ObligationCreateT & { external_ref: string }>): Promise<{ created: number; updated: number }> {
    let created = 0, updated = 0;
    for (const item of items) {
      const existing = await query<{ id: string; completed: boolean }>(
        'SELECT id, completed FROM obligations WHERE user_id = $1 AND source = $2 AND external_ref = $3',
        [user_id, item.source ?? 'ics', item.external_ref]
      );
      if (existing.rows[0]) {
        await query(
          `UPDATE obligations SET title = $3, description = $4, due_at = $5, start_at = $6, end_at = $7, all_day = $8 WHERE id = $1 AND user_id = $2`,
          [existing.rows[0].id, user_id, item.title, item.description ?? null, item.due_at ?? null, item.start_at ?? null, item.end_at ?? null, item.all_day ?? false]
        );
        updated++;
      } else {
        const r = await this.create(user_id, item);
        if (r.success) created++;
      }
    }
    return { created, updated };
  }

  async update(id: string, user_id: string, data: ObligationUpdateT): Promise<Result<ObligationT>> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return { success: false, code: 400, details: { error: 'BadRequest', message: 'No fields to update' } };
    const sets = entries.map(([k], i) => `${k} = $${i + 3}`);
    if (data.completed === true) sets.push('completed_at = COALESCE(completed_at, NOW())');
    if (data.completed === false) sets.push('completed_at = NULL');
    const res = await query(
      `UPDATE obligations SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, user_id, ...entries.map(([, v]) => v)]
    );
    if (!res.rows[0]) return notFound('Obligation not found');
    return { success: true, value: Obligation.parse(res.rows[0]) };
  }

  async delete(id: string, user_id: string): Promise<boolean> {
    const res = await query('DELETE FROM obligations WHERE id = $1 AND user_id = $2', [id, user_id]);
    return (res.rowCount ?? 0) > 0;
  }

  /** Open obligations due (or starting) within `hours` from now, soonest first. */
  async dueWithin(user_id: string, hours: number, kind?: ObligationKindT, minInterventionLevel = 0): Promise<ObligationT[]> {
    const vals: unknown[] = [user_id, hours, minInterventionLevel];
    let kindClause = '';
    if (kind) { vals.push(kind); kindClause = `AND kind = $${vals.length}`; }
    const res = await query(
      `SELECT * FROM obligations
       WHERE user_id = $1 AND NOT completed AND NOT archived ${kindClause}
         AND intervention_level >= $3
         AND COALESCE(due_at, start_at) IS NOT NULL
         AND COALESCE(due_at, start_at) BETWEEN NOW() - INTERVAL '1 hour' AND NOW() + ($2 || ' hours')::interval
       ORDER BY COALESCE(due_at, start_at) ASC`,
      vals
    );
    return res.rows.map(r => Obligation.parse(r));
  }

  async countDueWithin(user_id: string, hours: number): Promise<number> {
    const res = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM obligations
       WHERE user_id = $1 AND NOT completed AND NOT archived
         AND COALESCE(due_at, start_at) BETWEEN NOW() AND NOW() + ($2 || ' hours')::interval`,
      [user_id, hours]
    );
    return res.rows[0]?.n ?? 0;
  }

  /** Fuzzy title lookup for talk-back ("done with the pset"). */
  async findOpenByTitle(user_id: string, fragment: string): Promise<ObligationT | null> {
    const res = await query(
      `SELECT * FROM obligations WHERE user_id = $1 AND NOT completed AND NOT archived AND title ILIKE $2
       ORDER BY COALESCE(due_at, start_at) ASC NULLS LAST LIMIT 1`,
      [user_id, `%${fragment}%`]
    );
    return res.rows[0] ? Obligation.parse(res.rows[0]) : null;
  }
}

export default new ObligationRepository();
