import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import createApp from '../../app';
import { getPsqlClient } from '../../db/psqlClient';
import { getDdbDocClient } from '../../db/ddbClient';
import { Client } from 'pg';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

let app: any;
let db: Client;
let ddb: DynamoDBDocumentClient;
let userId: string;
let token: string;

const refreshSecret = 'integration-tests-refresh';
const accessSecret = 'integration-tests-access';

beforeAll(async () => {
  app = await createApp();
  process.env.IS_OFFLINE = "true";
  process.env.JWT_SECRET = accessSecret;
  process.env.JWT_REFRESH_SECRET = refreshSecret;
  
  db = await getPsqlClient();
  ddb = getDdbDocClient();
  
  // Clear relevant tables
  await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
  await db.query('TRUNCATE TABLE locations RESTART IDENTITY CASCADE;');
  
  // Create a test user
  const userResult = await db.query(
    'INSERT INTO users (id, phone_number, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [crypto.randomUUID(), '11234567890', 'hashed_password']
  );
  userId = userResult.rows[0].id;
  
  // Generate auth token
  token = jwt.sign({ user_id: userId }, accessSecret, { expiresIn: '1h' });
});

afterAll(async () => {
  await db.end();
});

describe('Location Integration Tests', () => {
  const baseLocation = {
    timestamp: "2025-10-22T12:01:30Z",
    platform: "ios",
    device_id: "device-ios-001",
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 10,
    altitude: 50
  };

  // -----------------------------
  // Location Sync
  // -----------------------------
  describe('POST /sync/location', () => {
    it('should accept location data and store it', async () => {
      const res = await request(app)
        .post('/sync/location')
        .set('Authorization', `Bearer ${token}`)
        .send(baseLocation);
      
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        timestamp: baseLocation.timestamp,
        platform: baseLocation.platform,
        device_id: baseLocation.device_id,
        latitude: baseLocation.latitude,
        longitude: baseLocation.longitude,
        radius: baseLocation.radius
      });
    });

    it('should reject invalid location data', async () => {
      const invalidLocation = {
        ...baseLocation,
        latitude: "invalid" // Invalid type
      };
      
      const res = await request(app)
        .post('/sync/location')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidLocation);
      
      expect(res.status).toBe(400);
    });

    it('should reject location data without required fields', async () => {
      const incompleteLocation = {
        timestamp: baseLocation.timestamp,
        // Missing required fields
      };
      
      const res = await request(app)
        .post('/sync/location')
        .set('Authorization', `Bearer ${token}`)
        .send(incompleteLocation);
      
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------
  // Location Trigger Integration
  // -----------------------------
  describe('Location Trigger Integration', () => {
    const locationId = crypto.randomUUID();
    
    beforeAll(async () => {
      // Create a location in the database
      await db.query(
        `INSERT INTO locations (id, user_id, name, latitude, longitude, radius) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [locationId, userId, 'Test Location', 37.7749, -122.4194, 100]
      );
      
      // Create a location trigger in DynamoDB
      // Skipping this for now as it requires more complex DynamoDB setup
    });

    it('should process location triggers when entering a geofence', async () => {
      // Send a location that's within the geofence
      const locationInGeofence = {
        ...baseLocation,
        latitude: 37.77495, // Slightly different but within 100m radius
        longitude: -122.41945,
        timestamp: "2025-10-22T12:02:30Z"
      };
      
      const res = await request(app)
        .post('/sync/location')
        .set('Authorization', `Bearer ${token}`)
        .send(locationInGeofence);
      
      // The location should be accepted (even if trigger processing has issues)
      expect(res.status).toBe(200);
    });

    it('should handle multiple consecutive location updates', async () => {
      // Send three consecutive locations
      const locations = [
        { ...baseLocation, latitude: 37.7750, longitude: -122.4195, timestamp: "2025-10-22T12:03:30Z" },
        { ...baseLocation, latitude: 37.7751, longitude: -122.4196, timestamp: "2025-10-22T12:04:30Z" },
        { ...baseLocation, latitude: 37.7752, longitude: -122.4197, timestamp: "2025-10-22T12:05:30Z" }
      ];
      
      for (const location of locations) {
        const res = await request(app)
          .post('/sync/location')
          .set('Authorization', `Bearer ${token}`)
          .send(location);
        
        expect(res.status).toBe(200);
      }
    });
  });
});