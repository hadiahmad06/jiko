import { vi } from 'vitest';
import request from 'supertest';
import createApp from '../../app'; // or wherever you create your Express app
import jwt from 'jsonwebtoken';

let app: any;

beforeAll(async () => {
  app = await createApp();
  process.env.JWT_REFRESH_SECRET = refreshSecret;
  process.env.JWT_SECRET = accessSecret;
})

const refreshSecret = 'test_refresh_secret';
const accessSecret = 'test_access_secret';

vi.mock('../data/UserManager', () => ({
  default: {
    updateAppUsage: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('Update API', () => {
  it('should allow posting an app usage update', async () => {
    // first, login with mock user to get real JWT token
    const token = jwt.sign({ user_id: 'user-123' }, accessSecret, { expiresIn: '1h' });

    const updatePayload = {
      timestamp: "2025-10-22T12:01:30Z",
      platform: "ios",
      deviceId: "device-ios-001",
      currentActivity: [
        {
          bundleId: "com.roblox.ios",
          appName: "Roblox",
          startTime: "2025-10-22T12:01:30Z",
          durationSeconds: 1800,
          isForeground: true
        }
      ]
    };

    const res = await request(app)
      .post('/update')
      .set('Authorization', `Bearer ${token}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('updated');
    expect(res.body.update).toMatchObject(updatePayload);
  });
});