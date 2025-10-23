

import request from 'supertest';
import app from '../../src/index';
import UserManager from '../../src/UserManager';

jest.mock('../../src/UserManager');
const mockedAddUser = UserManager.addUser as jest.Mock;

beforeEach(() => {
  mockedAddUser.mockReset();
});

describe('Auth API - /auth/signup', () => {
  it('should signup with only phoneNumber and password', async () => {
    mockedAddUser.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/auth/signup')
      .send({ phoneNumber: '+11234567890', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  it('should signup with all attributes', async () => {
    mockedAddUser.mockResolvedValue({ success: true });

    const res = await request(app)
      .post('/auth/signup')
      .send({
        phoneNumber: '+11234567890',
        password: 'password123',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        nickname: 'Tester'
      });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeDefined();
    expect(res.body.token).toBeDefined();
  });

  it('should fail signup with OTP (not implemented)', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ phoneNumber: '+11234567890', otp: '123456' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('OTP validation not implemented');
  });
});