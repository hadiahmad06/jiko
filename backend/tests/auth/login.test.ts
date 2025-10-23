import request from 'supertest';
import app from '../../src/index'; // path to your Express app
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import UserManager from '../../src/UserManager';
import type { UserLookup } from '../../src/UserManager';

describe('Auth API - /auth/login', () => {
  const testUser = {
    uuid: 'user-123',
    phoneNumber: '+11234567890',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    nickname: 'Tester',
    password: 'password123',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    appUsage: {},
  };

  beforeAll(async () => {
    // Mock UserManager.getUser to return testUser with hashed password
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    jest.spyOn(UserManager, 'getUser').mockImplementation(async (lookup: string | UserLookup) => {
      if (typeof lookup === "string") {
        lookup = { userId: lookup }
      }
      if (
        lookup.userId === testUser.uuid ||
        lookup.email === testUser.email ||
        lookup.username === testUser.username ||
        lookup.phoneNumber === testUser.phoneNumber
      ) {
        return { ...testUser, passwordHash: hashedPassword };
      }
      return undefined;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should return a token and user info when logging in with userId and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ userId: testUser.uuid, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.username).toBe(testUser.username);
    expect(res.body.email).toBe(testUser.email);
    expect(res.body.phoneNumber).toBe(testUser.phoneNumber);

    // Optionally verify JWT
    const decoded = jwt.decode(res.body.token) as any;
    expect(decoded.userId).toBe(testUser.uuid);
  });

  it('should return a token when logging in with email and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return a token when logging in with username and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: testUser.username, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return a token when logging in with phoneNumber and correct password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ phoneNumber: testUser.phoneNumber, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return 400 Bad Request if password and otp are missing', async () => {
    const res = await request(app).post('/auth/login').send({ userId: testUser.uuid });
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
      .send({ userId: testUser.uuid, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return 500 Internal Server Error for OTP login (not implemented)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ userId: testUser.uuid, otp: '123456' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('OTP login not implemented');
  });
});