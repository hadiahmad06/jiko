import request from 'supertest';
import jwt from 'jsonwebtoken';
import UserManager from '../../src/UserManager';
import app from '../../src/index'; // path to Express app

jest.mock('../../src/UserManager');
const mockedGetUser = UserManager.getUser as jest.Mock;

describe('Auth API - /auth/me', () => {
  const testUser = {
    uuid: 'user-123',
    phoneNumber: '+11234567890',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    nickname: 'Tester'
  };

  const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  const token = jwt.sign({ userId: testUser.uuid }, JWT_SECRET, { expiresIn: '1h' });

  beforeEach(() => {
    mockedGetUser.mockReset();
  });

  it('should return user info when token is valid', async () => {
    mockedGetUser.mockResolvedValue(testUser);

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      phoneNumber: testUser.phoneNumber,
      email: testUser.email,
      username: testUser.username,
      displayName: testUser.displayName,
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
    mockedGetUser.mockResolvedValue(undefined);
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});