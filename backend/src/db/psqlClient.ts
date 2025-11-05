import { Client } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';

const isOffline = process.env.IS_OFFLINE === 'true';
const REGION = process.env.AWS_REGION || 'us-east-2';
const RDS_HOST = process.env.RDS_HOST || '';
const RDS_PORT = process.env.RDS_PORT ? Number(process.env.RDS_PORT) : 5432;
const RDS_USER = process.env.RDS_USER || '';
const RDS_DB_NAME = process.env.RDS_DB_NAME || '';

let client : Client | null = null;

async function getPsqlClient() {
  if (!client) {
    if (isOffline) {
      const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres',
      });
      await client.connect();
      console.log('Postgres client connected successfully (local Docker)');
      return client;
    } else {
      const signer = new Signer({
        region: REGION,
        hostname: RDS_HOST,
        port: Number(RDS_PORT),
        username: RDS_USER,
      });

      const token = await signer.getAuthToken();

      client = new Client({
        host: RDS_HOST,
        port: Number(RDS_PORT),
        database: RDS_DB_NAME,
        user: RDS_USER,
        password: token,
        ssl: { rejectUnauthorized: false },
      });

      await client.connect();
      console.log('Postgres client connected successfully (AWS RDS with IAM authentication)');
    }
  }
  return client;
}

export { getPsqlClient };
