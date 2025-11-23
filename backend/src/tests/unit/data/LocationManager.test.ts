import { vi, describe, it, expect, beforeEach } from 'vitest';
import LocationManager from '../../../data/LocationManager';
import { LocationDataT } from '../../../types/user/sync/LocationData';
import { Result } from '../../../types/common/common';
import { checkLocationTriggersUnbatched } from '../../../services/triggers/locationTriggerService';

// Mock the location trigger service
vi.mock('../../../services/triggers/locationTriggerService', () => ({
  checkLocationTriggersUnbatched: vi.fn()
}));

const mockedCheckLocationTriggers = vi.mocked(checkLocationTriggersUnbatched);

describe('LocationManager', () => {
  const userId = 'test-user-123';
  const baseLocation: LocationDataT = {
    timestamp: "2025-10-22T12:01:30Z",
    platform: "ios",
    device_id: "device-ios-001",
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 10,
    altitude: 50
  };

  beforeEach(() => {
    // Clear all mocks and reset the LocationManager instance
    vi.clearAllMocks();
    // Reset the singleton instance by accessing the private property
    (LocationManager as any).locationQueues = {};
  });

  describe('updateLocation', () => {
    it('should initialize queue for new user and store location', async () => {
      const result = await LocationManager.updateLocation(userId, baseLocation);
      
      expect(result.success).toBe(true);
      expect((result as any).value).toEqual(baseLocation);
      expect(mockedCheckLocationTriggers).not.toHaveBeenCalled();
    });

    it('should add location to existing user queue', async () => {
      // First location for user
      await LocationManager.updateLocation(userId, baseLocation);
      
      // Second location for user
      const secondLocation: LocationDataT = {
        ...baseLocation,
        timestamp: "2025-10-22T12:02:30Z",
        latitude: 37.7750,
        longitude: -122.4195
      };
      
      const result = await LocationManager.updateLocation(userId, secondLocation);
      
      expect(result.success).toBe(true);
      expect((result as any).value).toEqual(secondLocation);
      expect(mockedCheckLocationTriggers).toHaveBeenCalledWith(
        userId, 
        baseLocation, 
        secondLocation
      );
    });

    it('should limit queue to 3 locations', async () => {
      // Add 4 locations
      for (let i = 0; i < 4; i++) {
        const location: LocationDataT = {
          ...baseLocation,
          timestamp: `2025-10-22T12:0${i}:30Z`,
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194 + i * 0.0001
        };
        await LocationManager.updateLocation(userId, location);
      }
      
      const history = await LocationManager.getLocationHistory(userId);
      expect(history.success).toBe(true);
      expect((history as any).value).toHaveLength(3);
    });

    it('should continue successfully even when trigger service fails', async () => {
      // Mock an error in the trigger service
      mockedCheckLocationTriggers.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await LocationManager.updateLocation(userId, baseLocation);
      
      // Should still succeed since we catch trigger errors
      expect(result.success).toBe(true);
      expect((result as any).value).toEqual(baseLocation);
    });
  });

  describe('getLocationHistory', () => {
    it('should return empty array for non-existent user', async () => {
      const result = await LocationManager.getLocationHistory('non-existent-user');
      
      expect(result.success).toBe(true);
      expect((result as any).value).toEqual([]);
    });

    it('should return location history for existing user', async () => {
      // Add locations
      const locations: LocationDataT[] = [];
      for (let i = 0; i < 3; i++) {
        const location: LocationDataT = {
          ...baseLocation,
          timestamp: `2025-10-22T12:0${i}:30Z`,
          latitude: 37.7749 + i * 0.0001,
          longitude: -122.4194 + i * 0.0001
        };
        locations.push(location);
        await LocationManager.updateLocation(userId, location);
      }
      
      const result = await LocationManager.getLocationHistory(userId);
      
      expect(result.success).toBe(true);
      expect((result as any).value).toEqual(locations);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in the trigger service (which shouldn't be called)
      mockedCheckLocationTriggers.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await LocationManager.getLocationHistory(userId);
      
      // Should still succeed since getLocationHistory doesn't call triggers
      expect(result.success).toBe(true);
      expect((result as any).value).toEqual([]);
    });
  });

  describe('getAllCached', () => {
    it('should return all cached locations', async () => {
      // Add locations for multiple users
      const user1 = 'user-1';
      const user2 = 'user-2';
      
      const location1: LocationDataT = { ...baseLocation, timestamp: "2025-10-22T12:01:30Z" };
      const location2: LocationDataT = { ...baseLocation, timestamp: "2025-10-22T12:02:30Z" };
      
      await LocationManager.updateLocation(user1, location1);
      await LocationManager.updateLocation(user2, location2);
      
      const allCached = LocationManager.getAllCached();
      
      expect(Object.keys(allCached)).toHaveLength(2);
      expect(allCached[user1]).toEqual([location1]);
      expect(allCached[user2]).toEqual([location2]);
    });
  });
});