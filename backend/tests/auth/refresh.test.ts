import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index'; // path to Express app

describe('POST /auth/refresh', () => {
  const refreshSecret = 'test_refresh_secret';
  const accessSecret = 'test_access_secret';

  beforeAll(() => {
    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_SECRET = accessSecret;
  });

  it('should return 400 if refresh token is missing', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing refresh token');
  });

  it('should return 500 if secrets are missing', async () => {
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_SECRET;

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'some-token' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server misconfiguration');

    process.env.JWT_REFRESH_SECRET = refreshSecret;
    process.env.JWT_SECRET = accessSecret;
  });

  it('should return 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired refresh token');
  });

  it('should issue a new access token for a valid refresh token', async () => {
    const validRefreshToken = jwt.sign({ userId: 'user123' }, refreshSecret, { expiresIn: '1h' });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: validRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const decoded = jwt.verify(res.body.token, accessSecret) as { userId: string };
    expect(decoded.userId).toBe('user123');
  });
});