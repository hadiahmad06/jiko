import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import createApp from '../../app';
import { getPsqlClient } from '../../db/psqlClient';
import { getDdbDocClient } from '../../db/ddbClient';
import { Client } from 'pg';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
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

describe('App Usage Integration Tests', () => {
  const baseAppUsage = {
    timestamp: "2025-10-22T12:01:30Z",
    platform: "ios",
    device_id: "device-ios-001",
    log: [
      {
        timestamp: "2025-10-22T12:01:30Z",
        bundleId: "com.example.app",
        appName: "Example App",
        startTime: "2025-10-22T12:01:30Z",
        durationSeconds: 1800,
        isForeground: true
      }
    ]
  };

  // -----------------------------
  // App Usage Sync
  // -----------------------------
  describe('POST /sync/app-usage', () => {
    it('should accept app usage data and store it', async () => {
      const res = await request(app)
        .post('/sync/app-usage')
        .set('Authorization', `Bearer ${token}`)
        .send(baseAppUsage);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('appUsage');
      expect(res.body).toHaveProperty('triggered_ids');
      expect(res.body.appUsage).toMatchObject({
        timestamp: baseAppUsage.timestamp,
        platform: baseAppUsage.platform,
        device_id: baseAppUsage.device_id
      });
    });

    it('should reject invalid app usage data', async () => {
      const invalidAppUsage = {
        ...baseAppUsage,
        platform: "invalid-platform" // Invalid platform
      };
      
      const res = await request(app)
        .post('/sync/app-usage')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidAppUsage);
      
      expect(res.status).toBe(400);
    });

    it('should reject app usage data without required fields', async () => {
      const incompleteAppUsage = {
        timestamp: baseAppUsage.timestamp,
        // Missing required fields
      };
      
      const res = await request(app)
        .post('/sync/app-usage')
        .set('Authorization', `Bearer ${token}`)
        .send(incompleteAppUsage);
      
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------
  // App Usage Trigger Integration
  // -----------------------------
  describe('App Usage Trigger Integration', () => {
    const triggerId = crypto.randomUUID();
    
    beforeAll(async () => {
      // Create an app usage trigger in DynamoDB with a simple precondition
      const triggerItem = {
        id: triggerId,
        user_id: userId,
        enabled_event_type: "true#specific_app_used", // enabled=true, event_type=specific_app_used
        bundle_id: "com.example.app",
        precondition: {
          type: "no_foreground_activity",
          params: {
            duration_minutes: 5
          }
        },
        action_json: [
          {
            type: "notify_user",
            params: {
              message: "App usage trigger activated!"
            }
          }
        ]
      };
      
      try {
        await ddb.send(new PutCommand({
          TableName: "APP_USAGE_TRIGGERS",
          Item: triggerItem
        }));
      } catch (error) {
        console.warn('Warning: Could not insert trigger into DynamoDB. This may be expected if local DynamoDB is not running.');
        console.warn('Error:', error);
      }
    });

    it('should process app usage triggers when conditions are met', async () => {
      // Send app usage data that should trigger the condition
      const appUsageWithTrigger = {
        ...baseAppUsage,
        timestamp: "2025-10-22T12:10:30Z",
        log: [
          {
            timestamp: "2025-10-22T12:10:30Z",
            bundleId: "com.example.app",
            appName: "Example App",
            startTime: "2025-10-22T12:10:30Z",
            durationSeconds: 300, // 5 minutes
            isForeground: true
          }
        ]
      };
      
      const res = await request(app)
        .post('/sync/app-usage')
        .set('Authorization', `Bearer ${token}`)
        .send(appUsageWithTrigger);
      
      // The app usage should be accepted
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('appUsage');
      expect(res.body).toHaveProperty('triggered_ids');
      
      // Note: We can't reliably test if the trigger was actually activated
      // without a running DynamoDB instance, but the request should succeed
    });

    it('should handle multiple consecutive app usage updates', async () => {
      // Send three consecutive app usage updates
      const appUsages = [
        {
          ...baseAppUsage,
          timestamp: "2025-10-22T12:15:30Z",
          log: [{
            timestamp: "2025-10-22T12:15:30Z",
            bundleId: "com.example.app",
            appName: "Example App",
            startTime: "2025-10-22T12:15:30Z",
            durationSeconds: 60,
            isForeground: true
          }]
        },
        {
          ...baseAppUsage,
          timestamp: "2025-10-22T12:16:30Z",
          log: [{
            timestamp: "2025-10-22T12:16:30Z",
            bundleId: "com.example.app",
            appName: "Example App",
            startTime: "2025-10-22T12:16:30Z",
            durationSeconds: 60,
            isForeground: true
          }]
        },
        {
          ...baseAppUsage,
          timestamp: "2025-10-22T12:17:30Z",
          log: [{
            timestamp: "2025-10-22T12:17:30Z",
            bundleId: "com.example.app",
            appName: "Example App",
            startTime: "2025-10-22T12:17:30Z",
            durationSeconds: 60,
            isForeground: true
          }]
        }
      ];
      
      for (const appUsage of appUsages) {
        const res = await request(app)
          .post('/sync/app-usage')
          .set('Authorization', `Bearer ${token}`)
          .send(appUsage);
        
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('appUsage');
        expect(res.body).toHaveProperty('triggered_ids');
      }
    });
  });
});