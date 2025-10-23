import type { AppUsageUpdate } from './types/AppUsageUpdate.js';
import type { Platform } from './types/Platform.js';
import type { User } from './types/User.js';

class UserManager {
  private cachedUsers: Record<string, User> = {};

  /**
   * Updates app usage for a user. Adds the user if missing,
   * and overwrites previous usage for the given platform.
   */
  updateAppUsage(userId: string, update: AppUsageUpdate) {
    const timestamp = update.timestamp ?? new Date().toISOString();

    // Add user if missing
    if (!this.cachedUsers[userId]) {
      this.cachedUsers[userId] = { uuid: userId, phoneNumber: '', appUsage: {} };
    }

    const user = this.cachedUsers[userId];

    // Initialize appUsage if missing
    user.appUsage = user.appUsage ?? {};

    // Overwrite the previous usage for the given platform
    const platformKey = update.platform as Platform;
    user.appUsage[platformKey] = {
      timestamp,
      platform: update.platform,
      currentActivity: update.currentActivity ?? [],
      deviceId: update.deviceId,
    };

    console.log(
      `Updated platform "${update.platform}" for user "${userId}" at ${timestamp}`
    );
  }

  // Optional: get user data
  getUserData(userId: string): User {
    return this.cachedUsers[userId] ?? { uuid: userId, phoneNumber: '', appUsage: {} };
  }

  // Optional: get all cached users
  getAllUsers(): Record<string, User> {
    return this.cachedUsers;
  }
}

export default new UserManager();