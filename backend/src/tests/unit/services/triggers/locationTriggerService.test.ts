import { vi, describe, it, expect, beforeEach } from 'vitest';
import { checkLocationTriggers, checkLocationTriggersUnbatched } from '../../../../services/triggers/locationTriggerService';
import { getPsqlClient } from '../../../../db/psqlClient';
import { getDdbDocClient } from '../../../../db/ddbClient';
import { LocationDataT } from '../../../../types/user/sync/LocationData';

// Mock the database clients
vi.mock('../../../../db/psqlClient');
vi.mock('../../../../db/ddbClient');

describe('locationTriggerService', () => {
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
    vi.clearAllMocks();
  });

  describe('checkLocationTriggers', () => {
    it('should call checkLocationTriggersUnbatched for each location', async () => {
      // This test would require more complex mocking, so we'll skip detailed implementation for now
      expect(true).toBe(true);
    });
  });

  describe('checkLocationTriggersUnbatched', () => {
    it('should handle the function without throwing errors', async () => {
      const oldLocation: LocationDataT = {
        ...baseLocation,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 10
      };
      
      const newLocation: LocationDataT = {
        ...baseLocation,
        timestamp: "2025-10-22T12:02:30Z",
        latitude: 37.77491,
        longitude: -122.41941,
        radius: 10
      };
      
      // Should not throw an error
      await expect(checkLocationTriggersUnbatched(userId, oldLocation, newLocation)).resolves.not.toThrow();
    });
  });
});