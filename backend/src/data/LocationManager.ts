import { Result } from '../types/common.js';
import { LocationDataT, LocationQueue } from '../types/user/LocationData.js';

// Manages location data storage with a fixed-size queue per user
class LocationManager {
  // { user_id : LocationQueue }
  private locationQueues: Record<string, LocationQueue> = {};

  async updateLocation(user_id: string, data: LocationDataT): Promise<Result<LocationDataT>> {
    try {
      // Initialize queue for user if it doesn't exist
      if (!this.locationQueues[user_id]) {
        this.locationQueues[user_id] = new LocationQueue(3); // Store last 3 locations
      }

      // Add new location to the queue
      this.locationQueues[user_id].push(data);

      return { 
        success: true, 
        value: data 
      };
    } catch (error) {
      console.error('Error updating location:', error);
      return { 
        success: false, 
        code: 500, 
        details: { 
          error: 'ServerError', 
          message: 'Failed to update location data' 
        } 
      };
    }
  }

  async getLocationHistory(user_id: string): Promise<Result<LocationDataT[]>> {
    try {
      const queue = this.locationQueues[user_id];
      if (!queue) {
        return { 
          success: true, 
          value: [] 
        };
      }

      return { 
        success: true, 
        value: queue.getAll() 
      };
    } catch (error) {
      console.error('Error retrieving location history:', error);
      return { 
        success: false, 
        code: 500, 
        details: { 
          error: 'ServerError', 
          message: 'Failed to retrieve location history' 
        } 
      };
    }
  }

  // withinGeofence(user_id)

  // Debug only
  getAllCached() {
    const result: Record<string, LocationDataT[]> = {};
    for (const [userId, queue] of Object.entries(this.locationQueues)) {
      result[userId] = queue.getAll();
    }
    return result;
  }
}

export default new LocationManager();