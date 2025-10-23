import request from 'supertest';
import app from '../src/index'; // or wherever you create your Express app
import jwt from 'jsonwebtoken';

describe('Auth API', () => {
  it('should allow posting an app usage update', async () => {
    // first, login with mock user to get real JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
    const token = jwt.sign({ userId: 'user-123' }, JWT_SECRET, { expiresIn: '1h' });

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