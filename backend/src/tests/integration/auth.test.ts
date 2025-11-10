import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import createApp from '../../app'; // your Express app
import { getPsqlClient } from '../../db/psqlClient';   // your DB client
import { Client } from 'pg';
import e from 'express';

let app: e.Application;
let db: Client;

beforeAll(async () => {
  app = await createApp();
  process.env.IS_OFFLINE = "true";
  process.env.JWT_SECRET = "integration-tests"
  process.env.JWT_REFRESH_SECRET = "integration-tests"
  db = await getPsqlClient();

  await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
});

afterAll(async () => {
  await db.end(); // close DB connection
});

describe('Auth Integration Tests', () => {
  let userIds: string[] = [];

  // -----------------------------
  // Signup
  // -----------------------------
  describe('POST /auth/signup', () => {
    it('should signup a user with phone_number and password', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          phone_number: '11234567890',
          password: 'Password123!',
        });
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user_id');
      userIds.push(res.body.user_id);
    });

    it('should signup a user with optional email and username', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          phone_number: '11234567891',
          password: 'Password123!',
          email: 'test@example.com',
          username: 'tester'
        });
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user_id');
      userIds.push(res.body.user_id);
    });

    it('should fail signup if phone_number is missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail signup if password is missing', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ phone_number: '11234567892' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail signup if phone_number is duplicate', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          phone_number: '11234567890',
          password: 'Password123!',
        });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail signup if email is duplicate', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          phone_number: '11234567893',
          password: 'Password123!',
          email: 'test@example.com',
        });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail signup if username is duplicate', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          phone_number: '11234567894',
          password: 'Password123!',
          username: 'tester',
        });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // -----------------------------
  // Login
  // -----------------------------
  describe('POST /auth/login', () => {
    it('should login with phone_number and password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          phone_number: '11234567890',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should login with user_id and password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          id: userIds[0],
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should fail login with wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          phone_number: '11234567890',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail login if no identifier provided', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});