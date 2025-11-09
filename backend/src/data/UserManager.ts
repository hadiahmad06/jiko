import UserRepository, { UserLookup } from '../services/UserRepository.js';
import type { AppUsageUpdateT } from '../types/appUsage/AppUsageUpdate.js';
import type { PlatformT } from '../types/device/Platform.js';
import type { UserT } from '../types/user/User.js';

class UserManager {
  private cache: Record<string, UserT> = {};

  async getUser(lookup: UserLookup | string): Promise<UserT | undefined> {
    if (typeof lookup === 'string') {
      lookup = { id: lookup };
    }
    const userId = lookup.id;
    if (userId && this.cache[userId]) {
      return this.cache[userId];
    }

    const user = await UserRepository.getUser(lookup);
    if (user?.id) {
      this.cache[user.id] = user;
    }
    return user;
  }

  async addUser(user: UserT) {
    const result = await UserRepository.addUser(user);
    if (result.success) {
      this.cache[user.id] = user;
    }
    return result;
  }

  async updateAppUsage(user_id: string, update: AppUsageUpdateT) {
    const timestamp = update.timestamp ?? new Date().toISOString();
    const user = await this.getUser({ id: user_id });
    if (!user) return;

    const platform = update.platform as PlatformT;
    user.appUsage[platform] = {
      timestamp,
      platform,
      currentActivity: update.currentActivity ?? [],
      deviceId: update.deviceId,
    };

    // Not persisted yet by design
  }

  getAllCached() {
    return { ...this.cache };
  }
}

export default new UserManager();