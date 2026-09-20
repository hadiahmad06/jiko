// src/services/repositories/MessageRepository.ts
import { query } from '../../db/psqlClient.js';
import { Message, MessageT, MessageQueryT } from '../../types/message/Message.js';

export interface NewOutbound {
  user_id: string;
  body: string;
  channel: string;
  trigger_id?: string | null;
  reply_to_id?: string | null;
  metadata?: Record<string, unknown>;
  status?: 'queued' | 'sent';
}

export interface NewInbound {
  user_id: string;
  body: string;
  channel: string;
  reply_to_id?: string | null;
  metadata?: Record<string, unknown>;
}

class MessageRepository {
  async createOutbound(m: NewOutbound): Promise<MessageT> {
    const res = await query(
      `INSERT INTO messages (user_id, direction, channel, body, status, trigger_id, reply_to_id, metadata, sent_at)
       VALUES ($1, 'outbound', $2, $3, $4::message_status, $5, $6, $7, CASE WHEN $4::text = 'sent' THEN NOW() ELSE NULL END) RETURNING *`,
      [m.user_id, m.channel, m.body, m.status ?? 'queued', m.trigger_id ?? null, m.reply_to_id ?? null, JSON.stringify(m.metadata ?? {})]
    );
    return Message.parse(res.rows[0]);
  }

  async createInbound(m: NewInbound): Promise<MessageT> {
    const res = await query(
      `INSERT INTO messages (user_id, direction, channel, body, status, reply_to_id, metadata, delivered_at)
       VALUES ($1, 'inbound', $2, $3, 'received', $4, $5, NOW()) RETURNING *`,
      [m.user_id, m.channel, m.body, m.reply_to_id ?? null, JSON.stringify(m.metadata ?? {})]
    );
    return Message.parse(res.rows[0]);
  }

  async list(user_id: string, q: MessageQueryT): Promise<MessageT[]> {
    const conds = ['user_id = $1'];
    const vals: unknown[] = [user_id];
    if (q.status) { vals.push(q.status); conds.push(`status = $${vals.length}`); }
    if (q.direction) { vals.push(q.direction); conds.push(`direction = $${vals.length}`); }
    if (q.since) { vals.push(q.since); conds.push(`created_at > $${vals.length}`); }
    vals.push(q.limit);
    const res = await query(`SELECT * FROM messages WHERE ${conds.join(' AND ')} ORDER BY created_at DESC LIMIT $${vals.length}`, vals);
    return res.rows.map(r => Message.parse(r));
  }

  /** Oldest-first so an agent displays them in order. */
  async queued(user_id: string, channel?: string, limit = 50): Promise<MessageT[]> {
    const res = channel
      ? await query(`SELECT * FROM messages WHERE user_id = $1 AND status = 'queued' AND direction = 'outbound' AND channel = $2 ORDER BY created_at ASC LIMIT $3`, [user_id, channel, limit])
      : await query(`SELECT * FROM messages WHERE user_id = $1 AND status = 'queued' AND direction = 'outbound' ORDER BY created_at ASC LIMIT $2`, [user_id, limit]);
    return res.rows.map(r => Message.parse(r));
  }

  async ack(user_id: string, ids: string[], status: 'sent' | 'delivered' | 'failed'): Promise<number> {
    const stamp = status === 'delivered' ? 'delivered_at = NOW(), sent_at = COALESCE(sent_at, NOW())' : status === 'sent' ? 'sent_at = COALESCE(sent_at, NOW())' : 'sent_at = sent_at';
    const res = await query(`UPDATE messages SET status = $3::message_status, ${stamp} WHERE user_id = $1 AND id = ANY($2::uuid[])`, [user_id, ids, status]);
    return res.rowCount ?? 0;
  }

  async get(id: string, user_id: string): Promise<MessageT | null> {
    const res = await query('SELECT * FROM messages WHERE id = $1 AND user_id = $2', [id, user_id]);
    return res.rows[0] ? Message.parse(res.rows[0]) : null;
  }

  /** Most recent outbound message, for talk-back context. */
  async lastOutbound(user_id: string): Promise<MessageT | null> {
    const res = await query(`SELECT * FROM messages WHERE user_id = $1 AND direction = 'outbound' ORDER BY created_at DESC LIMIT 1`, [user_id]);
    return res.rows[0] ? Message.parse(res.rows[0]) : null;
  }

  /** Outbound messages created since a timestamp that count against the interrupt budget. */
  async interruptsSince(user_id: string, since: Date): Promise<number> {
    const res = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM messages
       WHERE user_id = $1 AND direction = 'outbound' AND created_at >= $2
         AND status <> 'failed' AND COALESCE((metadata->>'counts_as_interrupt')::boolean, true)`,
      [user_id, since]
    );
    return res.rows[0]?.n ?? 0;
  }

  /** The most recent inbound answer of a given kind, e.g. a weekly reflection. */
  async lastOfKind(user_id: string, kind: string, withinDays = 14): Promise<MessageT | null> {
    const res = await query(
      `SELECT * FROM messages
       WHERE user_id = $1 AND direction = 'inbound' AND metadata->>'kind' = $2
         AND created_at >= NOW() - make_interval(days => $3)
       ORDER BY created_at DESC LIMIT 1`,
      [user_id, kind, withinDays]
    );
    return res.rows[0] ? Message.parse(res.rows[0]) : null;
  }

  /** Attach metadata to a message already stored (talk-back labelling a reply). */
  async tag(id: string, user_id: string, patch: Record<string, unknown>): Promise<void> {
    await query('UPDATE messages SET metadata = metadata || $3::jsonb WHERE id = $1 AND user_id = $2', [id, user_id, JSON.stringify(patch)]);
  }

  /** Recent conversation (both directions), oldest first, for LLM context. */
  async recent(user_id: string, limit = 12): Promise<MessageT[]> {
    const res = await query(`SELECT * FROM (SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2) t ORDER BY created_at ASC`, [user_id, limit]);
    return res.rows.map(r => Message.parse(r));
  }
}

export default new MessageRepository();
