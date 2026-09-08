// src/services/repositories/LocationRepository.ts
import { query } from '../../db/psqlClient.js';
import { Location, LocationT, LocationCreateT, LocationUpdateT } from '../../types/location/Location.js';
import { Result, notFound } from '../../types/common/common.js';

class LocationRepository {
  async list(user_id: string, includeArchived = false): Promise<LocationT[]> {
    const res = await query(
      `SELECT * FROM locations WHERE user_id = $1 ${includeArchived ? '' : 'AND NOT archived'} ORDER BY created_at DESC`,
      [user_id]
    );
    return res.rows.map(r => Location.parse(r));
  }

  async get(id: string, user_id: string): Promise<Result<LocationT>> {
    const res = await query('SELECT * FROM locations WHERE id = $1 AND user_id = $2', [id, user_id]);
    if (!res.rows[0]) return notFound('Location not found');
    return { success: true, value: Location.parse(res.rows[0]) };
  }

  async create(user_id: string, data: LocationCreateT): Promise<LocationT> {
    const loc = Location.parse({ user_id, ...data });
    const res = await query(
      `INSERT INTO locations (id, user_id, name, latitude, longitude, radius_m)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [loc.id, loc.user_id, loc.name, loc.latitude, loc.longitude, loc.radius_m]
    );
    return Location.parse(res.rows[0]);
  }

  async update(id: string, user_id: string, data: LocationUpdateT): Promise<Result<LocationT>> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return { success: false, code: 400, details: { error: 'BadRequest', message: 'No fields to update' } };
    const sets = entries.map(([k], i) => `${k} = $${i + 3}`).join(', ');
    const res = await query(
      `UPDATE locations SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, user_id, ...entries.map(([, v]) => v)]
    );
    if (!res.rows[0]) return notFound('Location not found');
    return { success: true, value: Location.parse(res.rows[0]) };
  }

  async delete(id: string, user_id: string): Promise<boolean> {
    const res = await query('DELETE FROM locations WHERE id = $1 AND user_id = $2', [id, user_id]);
    return (res.rowCount ?? 0) > 0;
  }

  /** Ids of the user's active locations whose geofence contains the point. */
  async containing(user_id: string, latitude: number, longitude: number): Promise<string[]> {
    const res = await query<{ id: string }>(
      `SELECT id FROM locations
       WHERE user_id = $1 AND NOT archived
         AND ST_DWithin(geog, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, radius_m)`,
      [user_id, longitude, latitude]
    );
    return res.rows.map(r => r.id);
  }
}

export default new LocationRepository();
