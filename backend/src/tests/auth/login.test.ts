import { vi } from 'vitest';

import request from 'supertest';
import createApp from '../../app'; // path to your Express app
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import UserManager from '../../data/UserManager';
import type { UserLookup } from '../../services/UserRepository';
import { UserT } from 'types/user/User';

let app: any;
let hashed_password: string;

beforeAll(async () => {
  app = await createApp();
  hashed_password = await bcrypt.hash('password123', 10);
})

describe('Auth API - /auth/login', () => {
  const testUser: UserT = {
    id: 'user-123',
    phone_number: '+11234567890',
    email: 'test@example.com',
    username: 'testuser',
    display_name: 'Test User',
    nickname: 'Tester',
    password_hash: hashed_password,
    is_active: true,
    // created_at: new Date().toISOString(),
    // updated_at: new Date().toISOString(),
    appUsage: {},
  };

  const refreshSecret = 'test_refresh_secret';
  const accessSecret = 'test_access_secret';

  beforeAll(async () => {
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_SECRET = accessSecret;

    // Mock UserManager.getUser to return testUser with hashed password
    vi.spyOn(UserManager, 'getUser').mockImplementation(async (lookup: UserLookup | string) => {
      if (typeof lookup === "string") {
        lookup = { id: lookup }
      }
      if (
        lookup.id === testUser.id ||
        lookup.email === testUser.email ||
        lookup.username === testUser.username ||
        lookup.phone_number === testUser.phone_number
      ) {
        return testUser;
      }
      return undefined;
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should return a token and user info when logging in with userId and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ userId: testUser.id, password: testUser.password_hash });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.username).toBe(testUser.username);
    expect(res.body.email).toBe(testUser.email);
    expect(res.body.phoneNumber).toBe(testUser.phone_number);

    // Optionally verify JWT
    const decoded = jwt.decode(res.body.token) as any;
    expect(decoded.userId).toBe(testUser.id);
  });

  it('should return a token when logging in with email and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password_hash });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return a token when logging in with username and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: testUser.username, password: testUser.password_hash });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return a token when logging in with phoneNumber and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ phoneNumber: testUser.phone_number, password: testUser.password_hash });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return 400 Bad Request if password and otp are missing', async () => {
    const res = await request(app).post('/auth/login').send({ userId: testUser.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing password and otp');
  });

  it('should return 404 Not Found if user does not exist', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ userId: 'nonexistent', password: 'whatever' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('should return 401 Unauthorized if password is invalid', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ userId: testUser.id, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return 500 Internal Server Error for OTP login (not implemented)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ userId: testUser.id, otp: '123456' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('OTP login not implemented');
  });
});