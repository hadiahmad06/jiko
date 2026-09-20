// scripts/migrate.ts
// Usage: npm run db:migrate            (uses DATABASE_URL, else PG* defaults)
//        PGDATABASE=jiko_test npm run db:migrate
import { Client } from 'pg';
import { connectionString, localPgConfig } from '../src/db/config.js';
import { ensureDatabase, migrate } from '../src/db/migrate.js';

const url = connectionString();

async function main() {
  // A managed database already exists and we may not be allowed to CREATE
  // DATABASE, so only the local path ensures it.
  const client = url
    ? new Client({
        connectionString: url,
        ...(process.env.PGSSL_NO_VERIFY === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
      })
    : await (async () => { const cfg = localPgConfig(); await ensureDatabase(cfg); return new Client(cfg); })();

  await client.connect();
  try { await migrate(client); } finally { await client.end(); }
}

main().catch(err => { console.error(err); process.exit(1); });
