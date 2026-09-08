// Runs before every integration test file. Points the pool at the test DB and
// makes sure the schema is current. Never touches the dev database.
import { beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { migrate, ensureDatabase } from '../../db/migrate.js';
import { localPgConfig } from '../../db/config.js';
import { closePool } from '../../db/psqlClient.js';

process.env.NODE_ENV = 'test';
process.env.IS_OFFLINE = 'true';
process.env.PGDATABASE = process.env.PGDATABASE && process.env.PGDATABASE !== 'jiko' ? process.env.PGDATABASE : 'jiko_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-tests-access';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'integration-tests-refresh';
process.env.ENABLE_SCHEDULER = 'false';
delete process.env.ANTHROPIC_API_KEY;

beforeAll(async () => {
  const cfg = localPgConfig();
  if (cfg.database === 'jiko') throw new Error('refusing to run integration tests against the dev database');
  await ensureDatabase(cfg);
  const client = new Client(cfg);
  await client.connect();
  try { await migrate(client, { log: () => {} }); } finally { await client.end(); }
});

afterAll(async () => {
  await closePool();
});
