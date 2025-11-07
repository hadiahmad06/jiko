import { Activity, type ActivityT } from '../types/activity/Activity.js';
import { ActivityEntry, type ActivityEntryT } from '../types/activity/ActivityEntry.js';
import { getPsqlClient } from '../db/psqlClient.js';
import { Result } from '../types/common.js';
import { z, ZodArray } from "zod";

class ActivityRepository {

  // * Activities CRUD Operations * //
  async getActivities(userId: string): Promise<Result<ActivityT[]>> {
    const client = await getPsqlClient();
    const res = await client.query(
      'SELECT * FROM activities WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    if (!res.rows) return { success: false, code: 404, details: { error: 'Not Found', message: 'Failed to fetch activities' }, };
    return { success: true, value: res.rows };
  }

  async getActivity(activityId: string, userId: string): Promise<Result<ActivityT>> {
    const client = await getPsqlClient();
    const res = await client.query(
      'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
      [activityId, userId]
    );
    if (!res.rows[0]) return { success: false, code: 404, details: { error: 'Not Found', message: 'Failed to fetch activity' }, };
    return { success: true, value: res.rows[0] };
  }

  async createActivity(activity: ActivityT): Promise<Result<ActivityT>> {
    const client = await getPsqlClient();
    const res = await client.query(
      `INSERT INTO activities (id, user_id, name, description, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        activity.id,
        activity.user_id,
        activity.name,
        activity.description,
        activity.created_at,
      ]
    );
    if (!res.rows[0]) return { success: false, code: 500, details: { error: 'Internal Server Error', message: 'Failed to create activity' }, };
    return { success: true, value: res.rows[0] };
  }

  async updateActivity(data: PartialActivityWithIdsT): Promise<Result<ActivityT>> {
    const client = await getPsqlClient();
    
    // Exclude id, user_id, created_at, updated_at from updatable fields
    const { id, user_id, created_at, updated_at, ...fieldsToUpdate } = data;
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Build SET clause dynamically
    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return { success: false, code: 400, details: { error: 'Bad Request', message: 'Failed to update activity because no new fields were provided.' }, };
    }

    // Add id and user_id for WHERE clause
    values.push(id);
    values.push(user_id);
    const setQuery = setClauses.join(', ');
    const query = `
      UPDATE activities
      SET ${setQuery}
      WHERE id = $${idx} AND user_id = $${idx + 1}
      RETURNING *
    `;
    const res = await client.query(query, values);

    if (!res.rows[0]) return { success: false, code: 404, details: { error: 'Not Found', message: 'Failed to update activity because it does not exist' }, };
    return { success: true, value: res.rows[0] };
  }

  async deleteActivity(activityId: string, userId: string): Promise<Boolean> {
    const client = await getPsqlClient();
    const result = await client.query(
      'DELETE FROM activities WHERE id = $1 AND user_id = $2',
      [activityId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  // * Activity Entry CRUD Operations * //
  async addEntry(entry: ActivityEntryT): Promise<Result<ActivityEntryT>> {
    const client = await getPsqlClient();

    // Ensure entry.activity_id belongs to userId
    const activityRes = await client.query(
      'SELECT 1 FROM activities WHERE id = $1 AND user_id = $2',
      [entry.activity_id, entry.user_id]
    );

    // If no such activity, return error
    if (activityRes.rowCount === 0) {
      return { success: false, code: 404, details: { error: 'Not Found', message: 'Failed to create entry because activity does not exist.' }, };
    }

    const res = await client.query(
      `INSERT INTO activity_entries (id, activity_id, start_time, end_time, note, logged_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        entry.id,
        entry.activity_id,
        entry.start_time,
        entry.end_time,
        entry.notes,
        entry.logged_by,
        entry.confidence_score
      ]
    );

    if (!res.rows[0]) return { success: false, code: 500, details: { error: 'Internal Server Error', message: 'Failed to create activity entry.' }, };
    return { success: true, value: res.rows[0] };
  }
  
  async updateEntry(data: PartialActivityEntryWithIdsT): Promise<Result<ActivityEntryT>> {
    const client = await getPsqlClient();

    // Exclude id, user_id, activity_id, created_at, updated_at from updatable fields
    const { id, user_id, activity_id, created_at, updated_at, ...fieldsToUpdate } = data;
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Build SET clause dynamically
    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return { success: false, code: 400, details: { error: 'Bad Request', message: 'Failed to update activity entry because no new fields were provided.' }, };
    }

    // Add id and user_id for WHERE clause
    values.push(id);
    values.push(user_id);
    const setQuery = setClauses.join(', ');
    const query = `
      UPDATE activity_entries
      SET ${setQuery}
      WHERE id = $${idx} AND user_id = $${idx + 1}
      RETURNING *
    `;
    const res = await client.query(query, values);

    if (!res.rows[0]) return { success: false, code: 404, details: { error: 'Not Found', message: 'Failed to update activity entry beacuse entry does not exist.' }, };
    return { success: true, value: res.rows[0] };
  }

  async getEntriesForActivity(id: string, 
                              options: Omit<ActivityQueryT, 'activityIds'>, 
                              userId: string): 
  Promise<Result<ActivityEntryT[]>> {
    return this.getEntries({ activityIds:[id], ...options }, userId);
  }

  async getEntries(options: ActivityQueryT, userId: string): Promise<Result<ActivityEntryT[]>> {
    const { activityIds, startDate, endDate, limit } = options;
    const client = await getPsqlClient();

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Filter directly on ae.user_id since user_id is now a column in activity_entries
    let query =
      'SELECT * FROM activity_entries';
    conditions.push(`ae.user_id = $${idx}`);
    values.push(userId);
    idx++;

    if (activityIds && activityIds.length > 0) {
      conditions.push(`activity_id = ANY($${idx}::uuid[])`);
      values.push(activityIds);
      idx++;
    }

    if (startDate) {
      conditions.push(`start_time >= $${idx}`);
      values.push(startDate);
      idx++;
    }

    if (endDate) {
      conditions.push(`start_time <= $${idx}`);
      values.push(endDate);
      idx++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY start_time DESC';

    if (limit && limit > 0) {
      query += ` LIMIT $${idx}`;
      values.push(limit);
    }

    const res = await client.query(query, values);
    if (!res.rows) return { success: false, code: 404, details: { error: 'Not Found', message: 'No rows matched query.' }, };
    return { success: true, value: res.rows };
  }

  async deleteEntry(entryId: string, userId: string): Promise<Boolean> {
    const client = await getPsqlClient();
    // Only delete if the entry belongs to an activity owned by userId
    const result = await client.query(
      `DELETE FROM activity_entries
       WHERE id = $1 AND user_id = $2`,
      [entryId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const PartialActivityWithIds = Activity
  .partial()
  .extend({
    id: z.uuid(),
    user_id: z.uuid()
  });

export type PartialActivityWithIdsT = z.infer<typeof PartialActivityWithIds>;

export const PartialActivityEntryWithIds = ActivityEntry
  .partial()
  .extend({
    id: z.uuid(),
    user_id: z.uuid()
  });

export type PartialActivityEntryWithIdsT = z.infer<typeof PartialActivityEntryWithIds>;

export const ActivityQuery = z.object({
  activityIds: z.array(z.uuid()).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().optional()
});

export type ActivityQueryT = z.infer<typeof ActivityQuery>;

export default new ActivityRepository();