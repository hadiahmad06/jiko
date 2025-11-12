import { vi } from 'vitest';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import UserManager from '../../../data/UserManager';
import createApp from '../../../app'; // path to Express app
import { UserT } from 'types/user/User';


let app: any;

beforeAll(async () => {
  app = await createApp();
  process.env.JWT_REFRESH_SECRET = refreshSecret;
  process.env.JWT_SECRET = accessSecret;
})

const refreshSecret = 'test_refresh_secret';
const accessSecret = 'test_access_secret';

vi.mock('../../../data/UserManager');
const mockedGetUser = vi.mocked(UserManager.getUser);

describe('Auth API - /auth/me', () => {
  const testUser: UserT = {
    id: 'user-123',
    phone_number: '+11234567890',
    password_hash: '123321313',
    email: 'test@example.com',
    username: 'testuser',
    display_name: 'Test User',
    nickname: 'Tester',
    is_active: true
  };

  beforeAll(() => {
  });

  const token = jwt.sign({ userId: testUser.id }, accessSecret, { expiresIn: '1h' });

  beforeEach(() => {
    mockedGetUser.mockReset();
  });

  it('should return user info when token is valid', async () => {
    mockedGetUser.mockResolvedValue({ success: true, value: testUser });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      phoneNumber: testUser.phone_number,
      email: testUser.email,
      username: testUser.username,
      displayName: testUser.display_name,
      nickname: testUser.nickname
    });
  });

  it('should return 401 if Authorization header is missing', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing Authorization header');
  });

  it('should return 401 if token is invalid', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('should return 404 if user not found', async () => {
    mockedGetUser.mockResolvedValue({ success: false, code: 404, details: { error: '', message: '' } });
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});