// src/db/psqlClient.ts
// One pg.Pool per process. Offline mode (IS_OFFLINE=true or NODE_ENV=test) uses
// the local PG* settings; otherwise RDS with IAM auth tokens.
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';
import { connectionString, isOffline, localPgConfig } from './config.js';

let pool: Pool | null = null;

async function buildPool(): Promise<Pool> {
  const url = connectionString();
  if (url) {
    // Managed Postgres. `?sslmode=require` in the URL is respected by pg; the
    // flag below is for providers whose certificate chain pg can't verify.
    const p = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX || 10),
      ...(process.env.PGSSL_NO_VERIFY === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    p.on('error', err => console.error('pg pool error:', err));
    console.log('Postgres pool configured (DATABASE_URL)');
    return p;
  }

  if (isOffline()) {
    const p = new Pool({ ...localPgConfig(), max: 10 });
    p.on('error', err => console.error('pg pool error:', err));
    return p;
  }

  const REGION = process.env.AWS_REGION || 'us-east-2';
  const host = process.env.RDS_HOST || '';
  const port = Number(process.env.RDS_PORT || 5432);
  const user = process.env.RDS_USER || '';
  const database = process.env.RDS_DB_NAME || '';
  const signer = new Signer({ region: REGION, hostname: host, port, username: user });

  const p = new Pool({
    host,
    port,
    user,
    database,
    // IAM tokens expire after 15 minutes; pg calls this per new connection.
    password: async () => signer.getAuthToken(),
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
  p.on('error', err => console.error('pg pool error:', err));
  console.log('Postgres pool configured (AWS RDS, IAM auth)');
  return p;
}

export async function getPool(): Promise<Pool> {
  if (!pool) pool = await buildPool();
  return pool;
}

/** Back-compat name used across repositories. Returns the pool, which has the same `query` API. */
export async function getPsqlClient(): Promise<Pool> {
  return getPool();
}

export async function query<R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<R>> {
  const p = await getPool();
  return p.query<R>(text, params);
}

/** Runs fn inside a transaction; rolls back on throw. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
