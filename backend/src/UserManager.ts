import type { AppUsageUpdate } from './types/AppUsageUpdate.js';
import type { Platform } from './types/Platform.js';
import type { User } from './types/User.js';
import { getDdbDocClient } from './ddbClient.js';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// const TABLE_NAME = 'AppUsage';
const USERS_TABLE_NAME = 'Users';

class UserManager {
  private cachedUsers: Record<string, User> = {};

  /**
   * Updates app usage for a user. Adds the user if missing,
   * and overwrites previous usage for the given platform.
   */
  async updateAppUsage(userId: string, update: AppUsageUpdate): Promise<void> {
    const timestamp = update.timestamp ?? new Date().toISOString();
    const user = await this.getUser(userId);
    if (!user) { return; }

    // Overwrite the previous usage for the given platform
    const platformKey = update.platform as Platform;
    user.appUsage[platformKey] = {
      timestamp,
      platform: update.platform,
      currentActivity: update.currentActivity ?? [],
      deviceId: update.deviceId,
    };

    // DO NOT Save/update in DynamoDB, as this data is not persisted for now
    // try {
    //   await getDdbDocClient().send(new PutCommand({
    //     TableName: TABLE_NAME,
    //     Item: {
    //       PK: userId,
    //       SK: platformKey,
    //       timestamp,
    //       deviceId: update.deviceId,
    //       currentActivity: update.currentActivity ?? [],
    //     },
    //   }));
    // } catch (err) {
    //   console.error('Error updating DynamoDB AppUsage:', err);
    // }

    // if (process.env.NODE_ENV === 'test') {
    //   console.log(
    //     `Updated platform "${update.platform}" for user "${userId}" at ${timestamp}`
    //   );
    // }
  }

  // move to /login endpoint after integrating redis
  async getUser(userId: string): Promise<User | undefined> {
    let user = this.cachedUsers[userId];

    // Fetch user from DynamoDB
    try {
      const res = await getDdbDocClient().send(new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: userId },
      }));
      if (res.Item) {
        user = res.Item as User;
        this.cachedUsers[userId] = user;
      }
    } catch (err) {
      console.error('Error reading DynamoDB Users:', err);
    }

    return user;
  }

  // Optional: get all cached users
  getAllUsers(): Record<string, User> {
    return this.cachedUsers;
  }

  async addUser(user: User): Promise<{ success: boolean, message?: string }> {
    this.cachedUsers[user.uuid] = user;

    const { uuid, appUsage, ...rest } = user;
    const item = {
      PK: uuid,
      ...rest,
    }
    try {
      await getDdbDocClient().send(new PutCommand({
        TableName: USERS_TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)', // prevent overwriting existing user
      }));
      return { success: true };
    } catch (err) {
      console.error('Error adding user to DynamoDB Users table:', err);
      return { success: false, message: 'Error saving user. Try signing up again' };
    }
  }

}

export default new UserManager();