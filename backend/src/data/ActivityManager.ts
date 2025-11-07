import { ActivityT } from "types/activity/Activity.js";
import ActivityRepository, { ActivityQueryT, PartialActivityEntryWithIdsT, PartialActivityWithIdsT } from "../services/ActivityRepository.js";
import { ActivityEntryT } from "types/activity/ActivityEntry.js";
import { Result } from "types/common.js";

//TODO: add caching if necessary, using redis or simple dictionary cache or sm

class ActivityManager {

  // * Activities CRUD Operations * //
  // GET /activities
  async getActivities(user_id: string): Promise<Result<ActivityT[]>> {
    return ActivityRepository.getActivities(user_id);
  }

  // GET /activities/:id
  async getActivity(id: string, user_id: string): Promise<Result<ActivityT>> {
    return ActivityRepository.getActivity(id, user_id);
  }

  // POST /activities
  async createActivity(data: ActivityT): Promise<Result<ActivityT>> {
    return ActivityRepository.createActivity(data);
  }

  // PUT /activities/:id
  async updateActivity(data: PartialActivityWithIdsT): Promise<Result<ActivityT>> {
    return ActivityRepository.updateActivity(data);
  }

  // DELETE /activities/:id
  async deleteActivity(id: string, user_id: string): Promise<Boolean> {
    return ActivityRepository.deleteActivity(id, user_id);
  }

  // * Activity Entry CRUD Operations * //
  // GET /activities/:id/entries
  async getActivityEntries(
    id: string,
    options: Omit<ActivityQueryT, 'activityIds'>,
    user_id: string,
  ): Promise<Result<ActivityEntryT[]>> {
    return ActivityRepository.getEntriesForActivity(id, options, user_id);
  }

  // POST /activities/:id/entries
  async addEntry(data: ActivityEntryT): Promise<Result<ActivityEntryT>> {
    return ActivityRepository.addEntry(data);
  }

  // PATCH /activities/entries
  async updateEntry(data: PartialActivityEntryWithIdsT): Promise<Result<ActivityEntryT>> {
    return ActivityRepository.updateEntry(data);
  }

  // DELETE /activities/entries
  async deleteEntry(id: string, user_id: string): Promise<Boolean> {
    return ActivityRepository.deleteEntry(id, user_id);
  }

  // GET /activities/entries
  async getEntries(
    options: ActivityQueryT,
    user_id: string,
  ): Promise<Result<ActivityEntryT[]>> {
    return ActivityRepository.getEntries(options, user_id);
  }
}

export default new ActivityManager();