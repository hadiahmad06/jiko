// src/data/AppUsageManager.ts
//
// Holds the last hour of raw app-usage logs per user/device in memory (what
// conditions look at), rolls durable per-day totals into Postgres, and wakes
// the trigger engine. Process-local by design: one server process for now.
import { runTriggers, FiringReport } from '../services/triggers/engine.js';
import UsageRepository, { deltasByDay } from '../services/repositories/UsageRepository.js';
import PreferencesRepository from '../services/repositories/PreferencesRepository.js';
import { Result } from '../types/common/common.js';
import { appendAppUsage, type AppUsageRecordT, type AppUsageDataT } from '../types/user/sync/AppUsageData.js';

const MAX_ENTRIES = 500;
const MAX_AGE_SEC = 3600;

class AppUsageManager {
  private cache: Record<string, AppUsageRecordT> = {};

  async getAppUsage(user_id: string): Promise<Result<AppUsageRecordT>> {
    const result = this.cache[user_id];
    if (!result) return { success: false, code: 404, details: { error: 'NotFound', message: 'No app usage cached for user.' } };
    return { success: true, value: result };
  }

  async getAppUsageForDevice(user_id: string, device_id: string): Promise<Result<AppUsageDataT>> {
    const result = this.cache[user_id]?.[device_id];
    if (!result) return { success: false, code: 404, details: { error: 'NotFound', message: 'No app usage cached for device.' } };
    return { success: true, value: result };
  }

  /** All devices' cached payloads for a user (for the scheduler's context). */
  snapshot(user_id: string): AppUsageDataT[] {
    return Object.values(this.cache[user_id] ?? {});
  }

  async updateAppUsage(user_id: string, data: AppUsageDataT): Promise<Result<{ appUsage: AppUsageDataT; triggered_ids: string[]; firings: FiringReport[] }>> {
    data.timestamp = data.timestamp ?? new Date().toISOString();
    const oldData = this.cache[user_id]?.[data.device_id];

    // 1. merge into the in-memory window
    const merged = appendAppUsage(oldData, data, MAX_ENTRIES, MAX_AGE_SEC);
    if (!this.cache[user_id]) this.cache[user_id] = {};
    this.cache[user_id][data.device_id] = merged;

    // 2. durable daily rollup (only the new logs)
    try {
      const prefs = await PreferencesRepository.get(user_id);
      for (const [day, apps] of deltasByDay(data.log, prefs.timezone)) {
        await UsageRepository.addDeltas(user_id, data.device_id, day, apps.values());
      }
    } catch (err) {
      console.error('[app-usage] rollup failed:', err);
    }

    // 3. triggers
    let firings: FiringReport[] = [];
    try {
      firings = await runTriggers(user_id, { kind: 'app_usage', data, allDevices: this.snapshot(user_id) });
    } catch (err) {
      console.error('[app-usage] trigger run failed:', err);
    }

    return { success: true, value: { appUsage: merged, triggered_ids: firings.map(f => f.trigger_id), firings } };
  }

  // ! debug / tests only
  getAllCached() { return { ...this.cache }; }
  reset() { this.cache = {}; }
}

export default new AppUsageManager();
