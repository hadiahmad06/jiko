import { vi } from 'vitest';
import request from 'supertest';
import createApp from '../../../app'; // or wherever you create your Express app
import jwt from 'jsonwebtoken';
import AppUsageManager from '../../../data/AppUsageManager';
import { AppUsageDataT } from '../../../types/user/sync/AppUsageData';
import { Result } from '../../../types/common/common';

let app: any;

beforeAll(async () => {
  app = await createApp();
  process.env.JWT_REFRESH_SECRET = refreshSecret;
  process.env.JWT_SECRET = accessSecret;
})

const refreshSecret = 'test_refresh_secret';
const accessSecret = 'test_access_secret';

const token = jwt.sign({ user_id: 'user-123' }, accessSecret, { expiresIn: '1h' });
const updatePayload: AppUsageDataT = {
  timestamp: "2025-10-22T12:01:30Z",
  platform: "ios",
  device_id: "device-ios-001",
  log: [
    {
      timestamp: "2025-10-22T12:01:30Z",
      bundleId: "com.roblox.ios",
      appName: "Roblox",
      startTime: "2025-10-22T12:01:30Z",
      durationSeconds: 1800,
      isForeground: true
    }
  ]
};

vi.mock('../../../data/AppUsageManager');
const mockedUpdateAppUsage = vi.mocked(AppUsageManager.updateAppUsage);
const mockSuccessfulResult: Result<AppUsageDataT> = { success: true, value: updatePayload }
const mockFailedResult: Result<AppUsageDataT> = { success: false, code: 404, details: { error: '', message: '' }}

describe('AppUsageAPI', () => {
  describe('GET /sync/app-usage', () => {
    it('should get all app usage for a user', async () => {
      mockedUpdateAppUsage.mockResolvedValue(mockSuccessfulResult);
      // // first, login with mock user to get real JWT token
      // const res = await request(app)
      //   .post('/sync/app-usage')
      //   .set('Authorization', `Bearer ${token}`)
      //   .send(updatePayload);

      // expect(res.status).toBe(200);
      // expect(res.body).toMatchObject(updatePayload);
    });
  });
  describe('GET /sync/app-usage/:id', () => {
    it('should get all app usage for a device_id', async () => {
      mockedUpdateAppUsage.mockResolvedValue(mockSuccessfulResult);
      // first, login with mock user to get real JWT token
      // const { timestamp, ...incompletePayload } = updatePayload
      // const res = await request(app)
      //   .post('/sync/app-usage')
      //   .set('Authorization', `Bearer ${token}`)
      //   .send(incompletePayload);

      // expect(res.status).toBe(400);
    });
  });
  describe('GET /sync/app-usage', () => {
    it('should allow posting an app usage update', async () => {
      mockedUpdateAppUsage.mockResolvedValue(mockSuccessfulResult);
      // first, login with mock user to get real JWT token
      const res = await request(app)
        .post('/sync/app-usage')
        .set('Authorization', `Bearer ${token}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(updatePayload);
    });
    it('should reject posting an incomplete update', async () => {
      mockedUpdateAppUsage.mockResolvedValue(mockFailedResult);
      // first, login with mock user to get real JWT token
      const { timestamp, ...incompletePayload } = updatePayload
      const res = await request(app)
        .post('/sync/app-usage')
        .set('Authorization', `Bearer ${token}`)
        .send(incompletePayload);

      expect(res.status).toBe(400);
    });
  });
});

