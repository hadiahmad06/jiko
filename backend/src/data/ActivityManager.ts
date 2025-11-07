import { ActivityT } from "types/activity/Activity.js";
import ActivityRepository, { ActivityQuery, PartialActivityWithIds } from "../services/ActivityRepository.js";
import { ActivityEntryT } from "types/activity/ActivityEntry.js";

//TODO: add caching if necessary, using redis or simple dictionary cache or sm

class ActivityManager {
  // GET /activities
  async getActivities(user_id: string): Promise<ActivityT[]> {
    return ActivityRepository.getActivities(user_id);
  }

  // GET /activities/:id
  async getActivity(id: string, user_id: string): Promise<ActivityT | null> {
    return ActivityRepository.getActivity(id, user_id);
  }

  // POST /activities
  async createActivity(data: ActivityT): Promise<ActivityT> {
    return ActivityRepository.createActivity(data);
  }

  // PUT /activities/:id
  async updateActivity(data: ActivityT): Promise<ActivityT> {
    return ActivityRepository.updateActivity(data);
  }

  // DELETE /activities/:id
  async deleteActivity(id: string, user_id: string): Promise<Boolean> {
    return ActivityRepository.deleteActivity(id, user_id);
  }

  // GET /activities/:id/entries
  async getActivityEntries(
    id: string,
    options: Omit<ActivityQuery, 'activityIds'>,
    user_id: string,
  ): Promise<ActivityEntryT[]> {
    return ActivityRepository.getEntriesForActivity(id, options, user_id);
  }

  // POST /activities/:id/entries
  async addEntry(data: ActivityEntryT): Promise<ActivityEntryT> {
    return ActivityRepository.addEntry(data);
  }

  // PUT /activities/:id/entries
  async updateEntry(data: PartialActivityWithIds): Promise<ActivityEntryT> {
    return ActivityRepository.updateEntry(data);
  }

  // DELETE /activities/:id/entries
  async deleteActivityEntry(id: string, user_id: string): Promise<Boolean> {
    return ActivityRepository.deleteActivityEntry(id, user_id);
  }

  // GET /activities/entries
  async getEntries(
    options: ActivityQuery,
    user_id: string,
  ): Promise<ActivityEntryT[]> {
    return ActivityRepository.getEntries(options, user_id);
  }
}

export default new ActivityManager();