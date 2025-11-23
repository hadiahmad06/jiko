import { Result } from '../types/common/common.js';
import { appendAppUsage, type AppUsageRecordT, type AppUsageDataT } from '../types/user/sync/AppUsageData.js';

// stores unpersisted app usage for reference and llm content shit
// ? how long should it last?? 1 day, 6 hours, or replaced immediately with new sync?
// currently 1 hour with a max of 100 app entires per device.

// might just change this completely later
class AppUsageManager {
  // { user_id : unpersisted AppUsage }
  private cache: Record<string, AppUsageRecordT> = {};

  async getAppUsage(user_id: string): Promise<Result<AppUsageRecordT>> {
    const result = this.cache[user_id];
    if (!result) return { success: false, code: 404, details: { error: 'No data found', message: 'No data was cached.' } }
    return { success: true, value: result }
  }
  
  async getAppUsageForDevice(user_id: string, device_id: string): Promise<Result<AppUsageDataT>> {
    const result = this.cache[user_id]?.[device_id];
    if (!result) return { success: false, code: 404, details: { error: 'No data found', message: 'No data was cached.' } }
    return { success: true, value: result } 
  }

  async updateAppUsage(user_id: string, data: AppUsageDataT): Promise<Result<AppUsageDataT>> {
    const timestamp = data.timestamp ?? new Date().toISOString();
    const device_id = data.device_id
    const oldData = this.cache[user_id]?.[data.device_id]
    data.timestamp = timestamp
    
    const result = appendAppUsage(oldData, data, 100, 3600) // 100 entry limit, 3600 maxAgeSec (1 hour)
    if (!this.cache[user_id]) this.cache[user_id] = {};
    this.cache[user_id][device_id] = result
    return { success: true, value: result }
  }

  // ! debug only
  getAllCached() {
    return { ...this.cache };
  }
}

export default new AppUsageManager();