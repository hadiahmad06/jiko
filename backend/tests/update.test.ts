import request from 'supertest';
import app from '../src/index'; // or wherever you create your Express app

describe('Auth API', () => {
  it('should allow posting an app usage update', async () => {
    // first, get a JWT token
    const loginRes = await request(app)
      .post('/login')
      .send({ userId: 'user-123' });
    const token = loginRes.body.token;

    // construct update payload
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

    // console.log('[TEST DEBUG] Sending update payload:', updatePayload);

    const res = await request(app)
      .post('/update')
      .set('Authorization', `Bearer ${token}`)
      .send(updatePayload);

    if (res.status === 401 || res.status === 400) {
      // console.error('[TEST DEBUG] Error response from /update:', res.status, res.body);
    } else {
      // console.log('[TEST DEBUG] Response from /update:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('updated');
    expect(res.body.update).toMatchObject(updatePayload);
  });
});