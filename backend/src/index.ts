// src/index.ts
import dotenv from 'dotenv';
import createApp from './app.js';
import { startScheduler } from './services/triggers/scheduler.js';
import { closePool, query } from './db/psqlClient.js';

dotenv.config();
const PORT = Number(process.env.PORT || 3000);

(async () => {
  try {
    await query('SELECT 1');
  } catch (err) {
    console.error('Postgres is unreachable. Run `npm run localdb` (needs Docker) or set PG*/RDS_* env vars.', (err as Error).message);
    process.exit(1);
  }
  const app = await createApp();
  const server = app.listen(PORT, () => console.log(`jiko backend on :${PORT} (${process.env.IS_OFFLINE === 'true' ? 'offline/local' : 'aws'})`));
  const task = process.env.ENABLE_SCHEDULER !== 'false' ? startScheduler() : null;

  const shutdown = async () => {
    task?.stop();
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
