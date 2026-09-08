// src/services/repositories/DeviceRepository.ts
import { query } from '../../db/psqlClient.js';
import { Device, DeviceT, DeviceRegisterT } from '../../types/user/device/Device.js';
import { Result, notFound } from '../../types/common/common.js';

class DeviceRepository {
  async list(user_id: string): Promise<DeviceT[]> {
    const res = await query('SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at ASC', [user_id]);
    return res.rows.map(r => Device.parse(r));
  }

  async get(id: string, user_id: string): Promise<Result<DeviceT>> {
    const res = await query('SELECT * FROM devices WHERE id = $1 AND user_id = $2', [id, user_id]);
    if (!res.rows[0]) return notFound('Device not found');
    return { success: true, value: Device.parse(res.rows[0]) };
  }

  /** Upsert by id so an agent can re-register on every launch. */
  async register(user_id: string, data: DeviceRegisterT): Promise<DeviceT> {
    const d = Device.parse({ user_id, ...data, last_seen_at: new Date() });
    const res = await query(
      `INSERT INTO devices (id, user_id, platform, name, push_token, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET platform = EXCLUDED.platform,
         name = COALESCE(EXCLUDED.name, devices.name),
         push_token = COALESCE(EXCLUDED.push_token, devices.push_token),
         last_seen_at = NOW()
       WHERE devices.user_id = EXCLUDED.user_id
       RETURNING *`,
      [d.id, d.user_id, d.platform, d.name ?? null, d.push_token ?? null]
    );
    if (!res.rows[0]) throw new Error('device id belongs to another user');
    return Device.parse(res.rows[0]);
  }

  async update(id: string, user_id: string, fields: Record<string, unknown>): Promise<Result<DeviceT>> {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return { success: false, code: 400, details: { error: 'BadRequest', message: 'No fields to update' } };
    const sets = entries.map(([k], i) => `${k} = $${i + 3}`).join(', ');
    const res = await query(`UPDATE devices SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`, [id, user_id, ...entries.map(([, v]) => v)]);
    if (!res.rows[0]) return notFound('Device not found');
    return { success: true, value: Device.parse(res.rows[0]) };
  }

  async touch(id: string, user_id: string): Promise<void> {
    await query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1 AND user_id = $2', [id, user_id]);
  }

  async delete(id: string, user_id: string): Promise<boolean> {
    const res = await query('DELETE FROM devices WHERE id = $1 AND user_id = $2', [id, user_id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export default new DeviceRepository();
