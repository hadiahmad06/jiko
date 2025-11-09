import { vi } from 'vitest';

import request from 'supertest';
import createApp from '../../app';
import UserManager from '../../data/UserManager';

let app: any;

const refreshSecret = 'test_refresh_secret';
const accessSecret = 'test_access_secret';

beforeAll(async () => {
  app = await createApp();
  process.env.JWT_REFRESH_SECRET = refreshSecret;
  process.env.JWT_SECRET = accessSecret;
})

vi.mock('../../data/UserManager');
const mockedAddUser = vi.mocked(UserManager.addUser);

beforeEach(() => {
  mockedAddUser.mockReset();
});

describe('Auth API - /auth/signup', () => {
  it('should signup with only phoneNumber and password', async () => {
    mockedAddUser.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/auth/signup')
      .send({ phone_number: '+11234567890', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  it('should signup with all attributes', async () => {
    mockedAddUser.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/auth/signup')
      .send({
        phone_number: '+11234567890',
        password: 'Password123!',
        email: 'test@example.com',
        username: 'testuser',
        display_name: 'Test User',
        nickname: 'Tester'
      });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  it('should fail signup with OTP (not implemented)', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ phone_number: '+11234567890', otp: '123456' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('OTP validation not implemented');
  });
});