// src/data/LocationManager.ts
import { runTriggers, FiringReport } from '../services/triggers/engine.js';
import { Result } from '../types/common/common.js';
import { LocationDataT } from '../types/user/sync/LocationData.js';
import { Queue } from '../types/common/Queue.js';

const HISTORY = 5;

class LocationManager {
  private locationQueues: Record<string, Queue<LocationDataT>> = {};

  last(user_id: string): LocationDataT | null {
    return this.locationQueues[user_id]?.last() ?? null;
  }

  async updateLocation(user_id: string, data: LocationDataT): Promise<Result<{ location: LocationDataT; triggered_ids: string[]; firings: FiringReport[] }>> {
    try {
      if (!this.locationQueues[user_id]) this.locationQueues[user_id] = new Queue<LocationDataT>(HISTORY);
      const previous = this.locationQueues[user_id].last() ?? null;
      this.locationQueues[user_id].enqueue(data);

      let firings: FiringReport[] = [];
      try {
        firings = await runTriggers(user_id, { kind: 'location', previous, current: data });
      } catch (err) {
        console.error('[location] trigger run failed:', err);
      }
      return { success: true, value: { location: data, triggered_ids: firings.map(f => f.trigger_id), firings } };
    } catch (error) {
      console.error('Error updating location:', error);
      return { success: false, code: 500, details: { error: 'ServerError', message: 'Failed to update location data' } };
    }
  }

  async getLocationHistory(user_id: string): Promise<Result<LocationDataT[]>> {
    const queue = this.locationQueues[user_id];
    return { success: true, value: queue ? queue.getAll() : [] };
  }

  getAllCached() {
    const out: Record<string, LocationDataT[]> = {};
    for (const [k, q] of Object.entries(this.locationQueues)) out[k] = q.getAll();
    return out;
  }
  reset() { this.locationQueues = {}; }
}

export default new LocationManager();
