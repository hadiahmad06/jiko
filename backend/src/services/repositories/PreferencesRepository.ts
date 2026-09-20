// src/services/repositories/PreferencesRepository.ts
import { query } from '../../db/psqlClient.js';
import { UserPreferences, UserPreferencesT, UserPreferencesUpdateT } from '../../types/user/UserPreferences.js';

class PreferencesRepository {
  /** Always returns a row; inserts defaults on first access. */
  async get(user_id: string): Promise<UserPreferencesT> {
    const res = await query(
      `INSERT INTO user_preferences (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING *`,
      [user_id]
    );
    return UserPreferences.parse(res.rows[0]);
  }

  async update(user_id: string, data: UserPreferencesUpdateT): Promise<UserPreferencesT> {
    await this.get(user_id);
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.get(user_id);
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = entries.map(([k, v]) => (k === 'quiet_hours' ? JSON.stringify(v) : v));
    const res = await query(`UPDATE user_preferences SET ${sets} WHERE user_id = $1 RETURNING *`, [user_id, ...values]);
    return UserPreferences.parse(res.rows[0]);
  }

  /**
   * Start or clear a leased quiet window. `minutes` is a lease the device
   * renews; a device that stops reporting lets Jiko resume on its own.
   */
  async setQuiet(user_id: string, opts: { minutes: number | null; reason?: string | null }, now = new Date()): Promise<UserPreferencesT> {
    await this.get(user_id);
    const until = opts.minutes === null ? null : new Date(now.getTime() + opts.minutes * 60_000);
    const res = await query(
      'UPDATE user_preferences SET quiet_until = $2, quiet_reason = $3 WHERE user_id = $1 RETURNING *',
      [user_id, until, until ? (opts.reason ?? null) : null]
    );
    return UserPreferences.parse(res.rows[0]);
  }

  async reset(user_id: string): Promise<UserPreferencesT> {
    await query('DELETE FROM user_preferences WHERE user_id = $1', [user_id]);
    return this.get(user_id);
  }
}

export default new PreferencesRepository();
