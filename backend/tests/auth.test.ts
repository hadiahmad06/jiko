import request from 'supertest';
import app from '../src/index'; // or wherever you create your Express app

describe('Auth API', () => {
  it('should return a token when given a valid userId', async () => {
    const res = await request(app)
      .post('/login')
      .send({ userId: 'user-123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should return 400 if userId is missing', async () => {
    const res = await request(app).post('/login').send({});
    expect(res.status).toBe(400);
  });
});