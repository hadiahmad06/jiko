import { Result } from 'types/common.js';
import UserRepository, { UserLookup } from '../services/UserRepository.js';
import type { AppUsageUpdateT } from '../types/appUsage/AppUsageUpdate.js';
import type { PlatformT } from '../types/device/Platform.js';
import type { UserT } from '../types/user/User.js';

class UserManager {
  private cache: Record<string, UserT> = {};

  async getUser(lookup: UserLookup | string): Promise<Result<UserT>> {
    if (typeof lookup === 'string') {
      lookup = { id: lookup };
    }
    const userId = lookup.id;
    if (userId && this.cache[userId]) {
      return { success: true, value: this.cache[userId] };
    }

    const result = await UserRepository.getUser(lookup);
    if (result.success) {
      this.cache[result.value.id] = result.value;
    }
    return result;
  }

  async addUser(user: UserT): Promise<Result<UserT>> {
    const result = await UserRepository.addUser(user);
    if (result.success) {
      this.cache[result.value.id] = result.value;
    }
    return result;
  }

  async updateAppUsage(user_id: string, update: AppUsageUpdateT) {
    const timestamp = update.timestamp ?? new Date().toISOString();
    const result = await this.getUser({ id: user_id });
    if (!result.success) return;

    const platform = update.platform as PlatformT;
    result.value.appUsage[platform] = {
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