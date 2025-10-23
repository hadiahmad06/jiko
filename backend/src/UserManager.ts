import type { AppUsageUpdate } from './types/AppUsageUpdate.js';
import type { Platform } from './types/Platform.js';
import type { User } from './types/User.js';
import { getDdbDocClient } from './ddbClient.js';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = 'AppUsage';

class UserManager {
  private cachedUsers: Record<string, User> = {};

  /**
   * Updates app usage for a user. Adds the user if missing,
   * and overwrites previous usage for the given platform.
   */
  async updateAppUsage(userId: string, update: AppUsageUpdate) {
    const timestamp = update.timestamp ?? new Date().toISOString();

    // Check cached user
    if (!this.cachedUsers[userId]) {
      this.cachedUsers[userId] = { uuid: userId, phoneNumber: '', appUsage: {} };
    }
    const user = this.cachedUsers[userId];

    // Overwrite the previous usage for the given platform
    const platformKey = update.platform as Platform;
    user.appUsage[platformKey] = {
      timestamp,
      platform: update.platform,
      currentActivity: update.currentActivity ?? [],
      deviceId: update.deviceId,
    };

    // Save/update in DynamoDB
    try {
      await getDdbDocClient().send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: userId,
          SK: platformKey,
          timestamp,
          deviceId: update.deviceId,
          currentActivity: update.currentActivity ?? [],
        },
      }));
    } catch (err) {
      console.error('Error updating DynamoDB AppUsage:', err);
    }

    if (process.env.NODE_ENV === 'test') {
      console.log(
        `Updated platform "${update.platform}" for user "${userId}" at ${timestamp}`
      );
    }
  }

  // Optional: get user data
  async getUserData(userId: string): Promise<User> {
    if (!this.cachedUsers[userId]) {
      this.cachedUsers[userId] = { uuid: userId, phoneNumber: '', appUsage: {} };
    }
    const user = this.cachedUsers[userId];

    // Fetch latest appUsage from DynamoDB
    for (const platform of Object.keys(user.appUsage) as Platform[]) {
      try {
        const res = await getDdbDocClient().send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK: userId, SK: platform },
        }));
        if (res.Item) {
          user.appUsage[platform] = res.Item as any;
        }
      } catch (err) {
        console.error('Error reading DynamoDB AppUsage:', err);
      }
    }

    return user;
  }

  // Optional: get all cached users
  getAllUsers(): Record<string, User> {
    return this.cachedUsers;
  }
}

export default new UserManager();