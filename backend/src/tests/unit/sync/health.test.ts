import { vi } from 'vitest';
import request from 'supertest';
import createApp from '../../../app';
import jwt from 'jsonwebtoken';
import HealthManager from '../../../data/HealthManager';
import { HealthDataT } from '../../../types/user/HealthData';
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
const healthPayload: HealthDataT = {
  timestamp: "2025-10-22T12:01:30Z",
  platform: "ios",
  device_id: "device-ios-001",
  log: [
    {
      timestamp: "2025-10-22T12:01:30Z",
      start_time: "2025-10-22T12:01:30Z",
      end_time: "2025-10-22T12:31:30Z",
      tags: ["workout"]
    }
  ]
};

vi.mock('../../../data/HealthManager');
const mockedUpdateHealth = vi.mocked(HealthManager.updateHealth);
const mockSuccessfulResult: Result<HealthDataT> = { success: true, value: healthPayload }
const mockFailedResult: Result<HealthDataT> = { success: false, code: 404, details: { error: '', message: '' }}

describe('HealthAPI', () => {
  describe('POST /sync/health', () => {
    it('should allow posting health data', async () => {
      mockedUpdateHealth.mockResolvedValue(mockSuccessfulResult);
      const res = await request(app)
        .post('/sync/health')
        .set('Authorization', `Bearer ${token}`)
        .send(healthPayload);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(healthPayload);
    });

    it('should reject posting incomplete health data', async () => {
      mockedUpdateHealth.mockResolvedValue(mockFailedResult);
      const { timestamp, ...incompletePayload } = healthPayload
      const res = await request(app)
        .post('/sync/health')
        .set('Authorization', `Bearer ${token}`)
        .send(incompletePayload);

      expect(res.status).toBe(400);
    });
  });
});