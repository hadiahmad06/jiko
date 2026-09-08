// scripts/migrate.ts
// Usage: npm run db:migrate            (uses PG* env / IS_OFFLINE defaults)
//        PGDATABASE=jiko_test npm run db:migrate
import { Client } from 'pg';
import { localPgConfig } from '../src/db/config.js';
import { ensureDatabase, migrate } from '../src/db/migrate.js';

const cfg = localPgConfig();
ensureDatabase(cfg)
  .then(async () => {
    const client = new Client(cfg);
    await client.connect();
    try { await migrate(client); } finally { await client.end(); }
  })
  .catch(err => { console.error(err); process.exit(1); });
