import type { UserT } from '../types/user/User.js';
import { getDdbDocClient } from '../ddbClient.js';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const USERS_TABLE_NAME = 'Users';

export type UserLookup = {
  userId?: string;
  phoneNumber?: string;
  email?: string;
  username?: string;
};

class UserRepository {
  async getUser(lookup: UserLookup): Promise<UserT | undefined> {
    let key: Record<string, string> = {};

    if (lookup.userId) key.PK = lookup.userId;
    else if (lookup.phoneNumber) key.phoneNumber = lookup.phoneNumber;
    else if (lookup.email) key.email = lookup.email;
    else if (lookup.username) key.username = lookup.username;
    else return undefined;

    try {
      const res = await getDdbDocClient().send(new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: key,
      }));

      return res.Item as UserT | undefined;
    } catch (err) {
      console.error('DynamoDB getUser error:', err);
      return undefined;
    }
  }

  async addUser(user: UserT): Promise<{ success: boolean; message?: string }> {
    const { uuid, appUsage, ...rest } = user;
    const item = {
      PK: uuid,
      ...rest,
    };

    try {
      await getDdbDocClient().send(new PutCommand({
        TableName: USERS_TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      }));
      return { success: true };
    } catch (err) {
      console.error('DynamoDB addUser error:', err);
      return { success: false, message: 'Error saving user — try again' };
    }
  }
}

export default new UserRepository();