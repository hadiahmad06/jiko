import { vi } from 'vitest';
import request from 'supertest';
import createApp from '../../../app';
import jwt from 'jsonwebtoken';
import LocationManager from '../../../data/LocationManager';
import { LocationDataT } from '../../../types/user/LocationData';
import { Result } from '../../../types/common';

let app: any;

beforeAll(async () => {
  app = await createApp();
  process.env.JWT_REFRESH_SECRET = refreshSecret;
  process.env.JWT_SECRET = accessSecret;
})

const refreshSecret = 'test_refresh_secret';
const accessSecret = 'test_access_secret';

const token = jwt.sign({ user_id: 'user-123' }, accessSecret, { expiresIn: '1h' });
const locationPayload: LocationDataT = {
  timestamp: "2025-10-22T12:01:30Z",
  platform: "ios",
  device_id: "device-ios-001",
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  altitude: 50
};

vi.mock('../../../data/LocationManager');
const mockedUpdateLocation = vi.mocked(LocationManager.updateLocation);
const mockSuccessfulResult: Result<LocationDataT> = { success: true, value: locationPayload }
const mockFailedResult: Result<LocationDataT> = { success: false, code: 404, details: { error: '', message: '' }}

describe('LocationAPI', () => {
  describe('POST /sync/location', () => {
    it('should allow posting location data', async () => {
      mockedUpdateLocation.mockResolvedValue(mockSuccessfulResult);
      const res = await request(app)
        .post('/sync/location')
        .set('Authorization', `Bearer ${token}`)
        .send(locationPayload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(locationPayload);
    });

    it('should reject posting incomplete location data', async () => {
      mockedUpdateLocation.mockResolvedValue(mockFailedResult);
      const { timestamp, ...incompletePayload } = locationPayload
      const res = await request(app)
        .post('/sync/location')
        .set('Authorization', `Bearer ${token}`)
        .send(incompletePayload);

      expect(res.status).toBe(400);
    });
  });
});