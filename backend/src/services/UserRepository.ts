import type { UserT } from '../types/user/User.js';
import { getPsqlClient } from '../db/psqlClient.js';

const USERS_TABLE_NAME = 'Users';

export type UserLookup = {
  id?: string;
  phone_number?: string;
  email?: string;
  username?: string;
};

class UserRepository {
  async getUser(lookup: UserLookup): Promise<UserT | undefined> {
    const client = await getPsqlClient();
    let query = '';
    let params: any[] = [];

    if (lookup.id)            { query = 'SELECT * FROM Users WHERE id = $1'; params = [lookup.id]; }
    else if (lookup.phone_number)  { query = 'SELECT * FROM Users WHERE phone_number = $1'; params = [lookup.phone_number]; }
    else if (lookup.email)        { query = 'SELECT * FROM Users WHERE email = $1'; params = [lookup.email]; }
    else if (lookup.username)     { query = 'SELECT * FROM Users WHERE username = $1'; params = [lookup.username]; }
    else return undefined;

    try {
      const res = await client.query(query, params);
      return res.rows[0] as UserT | undefined;
    } catch (err) {
      console.error('Postgres getUser error:', err);
      return undefined;
    }
  }

  async addUser(user: UserT): Promise<{ success: boolean; message?: string }> {
    const client = await getPsqlClient();

    const { appUsage, ...rest } = user

    const columns = [...Object.keys(rest)];
    const values = [...Object.values(rest)];
    const placeholders = values.map((_, i) => `$${i + 1}`);
    console.log(columns)

    const query = `INSERT INTO users (${columns.join(',')}) VALUES (${placeholders.join(',')})`;

    try {
      await client.query(query, values);
      return { success: true };
    } catch (err) {
      console.error('Postgres addUser error:', err);
      return { success: false, message: 'Error saving user — try again' };
    }
  }
}

export default new UserRepository();