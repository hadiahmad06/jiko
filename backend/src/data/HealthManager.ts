import { Result } from '../types/common.js';
import { appendHealth, HealthDataT, HealthRecordT } from '../types/user/HealthData.js';

// stores unpersisted health for reference and llm content shit
// currently 1 hour with a max of 100 app entires per device.

// might just change this completely later
class HealthManager {
  // { user_id : unpersisted AppUsage }
  private cache: Record<string, HealthRecordT> = {};

  async getHealth(user_id: string): Promise<Result<HealthRecordT>> {
    const result = this.cache[user_id];
    if (!result) return { success: false, code: 404, details: { error: 'No data found', message: 'No data was cached.' } }
    return { success: true, value: result }
  }
  
  async getHealthForDevice(user_id: string, device_id: string): Promise<Result<HealthDataT>> {
    const result = this.cache[user_id]?.[device_id];
    if (!result) return { success: false, code: 404, details: { error: 'No data found', message: 'No data was cached.' } }
    return { success: true, value: result } 
  }

  async updateHealth(user_id: string, data: HealthDataT): Promise<Result<HealthDataT>> {
    const timestamp = data.timestamp ?? new Date().toISOString();
    const device_id = data.device_id
    const oldData = this.cache[user_id]?.[data.device_id]
    data.timestamp = timestamp
    
    const result = appendHealth(oldData, data, 100, 3600) // 100 entry limit, 3600 maxAgeSec (1 hour)
    if (!this.cache[user_id]) this.cache[user_id] = {};
    this.cache[user_id][device_id] = result
    return { success: true, value: result }
  }

  // ! debug only
  getAllCached() {
    return { ...this.cache };
  }
}

export default new HealthManager();