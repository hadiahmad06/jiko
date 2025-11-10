import { User, type UserT } from '../types/user/User.js';
import { getPsqlClient } from '../db/psqlClient.js';
import { Result } from 'types/common.js';

const USERS_TABLE_NAME = 'Users';

export type UserLookup = {
  id?: string;
  phone_number?: string;
  email?: string;
  username?: string;
};

class UserRepository {
  async getUser(lookup: UserLookup): Promise<Result<UserT>> {
    const client = await getPsqlClient();
    let query = '';
    let params: any[] = [];

    if (lookup.id)            { query = 'SELECT * FROM Users WHERE id = $1'; params = [lookup.id]; }
    else if (lookup.phone_number)  { query = 'SELECT * FROM Users WHERE phone_number = $1'; params = [lookup.phone_number]; }
    else if (lookup.email)        { query = 'SELECT * FROM Users WHERE email = $1'; params = [lookup.email]; }
    else if (lookup.username)     { query = 'SELECT * FROM Users WHERE username = $1'; params = [lookup.username]; }
    else return { success: false, code: 400, details: { error: 'No query provided.', message: 'Should\'ve been caught by api.'}};

    try {
      const res = await client.query(query, params);
      const parsed = User.safeParse(res.rows[0])
      if (!parsed.success) return { success: false, code: 400, details: { error: 'No user found.', message: 'No user found in postgres'}}

      return { success: true, value: parsed.data }
    } catch (err) {
      console.error('Postgres getUser error:', err);
      return { success: false, code: 500, details: { error: 'Postgres getUser error:', message: err instanceof Error ? err.message : 'unknown error'}};
    }
  }

  async addUser(user: UserT): Promise<Result<UserT>> {
    const client = await getPsqlClient();

    const { appUsage, ...rest } = user

    const columns = [...Object.keys(rest)];
    const values = [...Object.values(rest)];
    const placeholders = values.map((_, i) => `$${i + 1}`);
    // console.log(columns)

    const query = `INSERT INTO users (${columns.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;

    try {
      const res = await client.query(query, values);
      const parsed = User.safeParse({ appUsage: {}, ...res.rows[0] });
      // console.log("parsed result: ", parsed)
      if (!parsed.success) {
        return { success: false, code: 400, details: { error: 'Invalid user data returned from database', message: 'Failed to parse user after insert' } };
      }
      return { success: true, value: parsed.data };
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as any).code === '23505') {
        // Unique violation error
        const detail = (err as any).detail as string | undefined;
        let conflictColumn = 'unknown';
        if (detail) {
          const match = detail.match(/\(([^)]+)\)=/);
          if (match && match[1]) {
            conflictColumn = match[1];
          }
        }
        // console.error("duplicate error")
        return { success: false, code: 400, details: { error: 'Duplicate key error', message: `A user with that ${conflictColumn} already exists.` } };
      }
      console.error('Postgres addUser error:', err);
      return { success: false, code: 500, details: { error: 'Error saving user', message: 'Error saving user — try again' } };
    }
  }
}

export default new UserRepository();