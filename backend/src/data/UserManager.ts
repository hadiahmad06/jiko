import { Result } from 'types/common.js';
import UserRepository, { UserLookup } from '../services/UserRepository.js';
import type { UserT } from '../types/user/User.js';

class UserManager {
  // * need to replace with something better... not rn tho
  // ? redis, or dictionary, think about it later
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

  // ! debug only
  getAllCached() {
    return { ...this.cache };
  }
}

export default new UserManager();