// src/data/HealthManager.ts
import { runTriggers, FiringReport } from '../services/triggers/engine.js';
import { Result } from '../types/common/common.js';
import { appendHealth, type HealthRecordT, type HealthDataT } from '../types/user/sync/HealthData.js';

class HealthManager {
  private cache: Record<string, HealthRecordT> = {};

  async getHealth(user_id: string): Promise<Result<HealthRecordT>> {
    const result = this.cache[user_id];
    if (!result) return { success: false, code: 404, details: { error: 'NotFound', message: 'No health data cached for user.' } };
    return { success: true, value: result };
  }

  async getHealthForDevice(user_id: string, device_id: string): Promise<Result<HealthDataT>> {
    const result = this.cache[user_id]?.[device_id];
    if (!result) return { success: false, code: 404, details: { error: 'NotFound', message: 'No health data cached for device.' } };
    return { success: true, value: result };
  }

  snapshot(user_id: string): HealthDataT[] {
    return Object.values(this.cache[user_id] ?? {});
  }

  async updateHealth(user_id: string, data: HealthDataT): Promise<Result<{ health: HealthDataT; triggered_ids: string[]; firings: FiringReport[] }>> {
    data.timestamp = data.timestamp ?? new Date().toISOString();
    const oldData = this.cache[user_id]?.[data.device_id];
    const merged = appendHealth(oldData, data, 500, 24 * 3600);
    if (!this.cache[user_id]) this.cache[user_id] = {};
    this.cache[user_id][data.device_id] = merged;

    let firings: FiringReport[] = [];
    try {
      firings = await runTriggers(user_id, { kind: 'health', data, allDevices: this.snapshot(user_id) });
    } catch (err) {
      console.error('[health] trigger run failed:', err);
    }
    return { success: true, value: { health: merged, triggered_ids: firings.map(f => f.trigger_id), firings } };
  }

  getAllCached() { return { ...this.cache }; }
  reset() { this.cache = {}; }
}

export default new HealthManager();
