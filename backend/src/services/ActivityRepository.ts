import { type ActivityT } from '../types/activity/Activity.js';
import { type ActivityEntryT } from '../types/activity/ActivityEntry.js';
import { getPsqlClient } from '../db/psqlClient.js';

class ActivityRepository {
  async getActivities(userId: string): Promise<ActivityT[]> {
    const client = await getPsqlClient();
    const res = await client.query(
      'SELECT * FROM activities WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows;
  }

  async getActivity(activityId: string, userId: string): Promise<ActivityT | null> {
    const client = await getPsqlClient();
    const res = await client.query(
      'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
      [activityId, userId]
    );
    return res.rows[0] || null;
  }

  async createActivity(activity: ActivityT): Promise<ActivityT> {
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
    return res.rows[0];
  }

  async updateActivity(activity: ActivityT): Promise<ActivityT> {
    const client = await getPsqlClient();
    const res = await client.query(
      `UPDATE activities SET name = $1, description = $2
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [
        activity.name,
        activity.description,
        activity.id,
        activity.user_id
      ]
    );
    return res.rows[0];
  }

  async deleteActivity(activityId: string, userId: string): Promise<Boolean> {
    const client = await getPsqlClient();
    const result = await client.query(
      'DELETE FROM activities WHERE id = $1 AND user_id = $2',
      [activityId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  async addActivityEntry(entry: ActivityEntryT): Promise<ActivityEntryT> {
    const client = await getPsqlClient();
    // Ensure entry.activity_id belongs to userId
    const activityRes = await client.query(
      'SELECT 1 FROM activities WHERE id = $1 AND user_id = $2',
      [entry.activity_id, entry.user_id]
    );
    if (activityRes.rowCount === 0) {
      throw new Error('Activity does not belong to user');
    }
    const res = await client.query(
      `INSERT INTO activity_entries (id, activity_id, start_time, note, is_user_logged)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        entry.id,
        entry.activity_id,
        entry.start_time,
        entry.notes,
        entry.is_user_logged
      ]
    );
    return res.rows[0];
  }

  async getActivityEntries(
    id: string,
    options: Omit<ActivityQuery, 'activityIds'>,
    userId: string
  ): Promise<ActivityEntryT[]> {
    return this.getEntries({ activityIds:[id], ...options }, userId);
  }

  async getEntries(
    options: ActivityQuery,
    userId: string
  ): Promise<ActivityEntryT[]> {
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
    return res.rows;
  }

  async deleteActivityEntry(entryId: string, userId: string): Promise<Boolean> {
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

export type ActivityQuery = {
    activityIds?: string[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}

export default new ActivityRepository();