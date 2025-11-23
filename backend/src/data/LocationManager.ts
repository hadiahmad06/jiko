import { checkLocationTriggersUnbatched } from '../services/triggers/locationTriggerService.js';
import { Result } from '../types/common/common.js';
import { LocationDataT } from '../types/user/sync/LocationData.js';
import { Queue } from '../types/common/Queue.js';

// Manages location data storage with a fixed-size queue per user
class LocationManager {
  // { user_id : LocationQueue }
  private locationQueues: Record<string, Queue<LocationDataT>> = {};

  async updateLocation(user_id: string, data: LocationDataT): Promise<Result<LocationDataT>> {
    try {
      // Initialize queue for user if it doesn't exist
      
      if (!this.locationQueues[user_id]) {
        this.locationQueues[user_id] = new Queue<LocationDataT>(3); // Store last 3 locations
} else {
        const lastKnownLocation = this.locationQueues[user_id].last();
        if(lastKnownLocation) {
          try {
            await checkLocationTriggersUnbatched(user_id, lastKnownLocation, data )
          } catch (triggerError) {
            // Log trigger errors but don't fail the location update
            console.error('Error checking location triggers:', triggerError);
          }
        }
      }

      // Add new location to the queue
      this.locationQueues[user_id].enqueue(data);

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