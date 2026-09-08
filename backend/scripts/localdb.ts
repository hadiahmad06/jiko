// scripts/localdb.ts
// Starts (or reuses) a local postgis container, waits for it, creates the dev and
// test databases, and applies migrations to both. Requires Docker.
import Docker from 'dockerode';
import { Client } from 'pg';
import { localPgConfig } from '../src/db/config.js';
import { ensureDatabase, migrate } from '../src/db/migrate.js';

const CONTAINER = 'jiko-postgres';
const IMAGE = 'postgis/postgis:15-3.3';

async function startPostgres(port: number) {
  const docker = new Docker();
  const existing = (await docker.listContainers({ all: true })).find(c => c.Names.includes(`/${CONTAINER}`));
  if (existing) {
    if (existing.State !== 'running') {
      await docker.getContainer(existing.Id).start();
      console.log(`started existing container ${CONTAINER}`);
    } else {
      console.log(`${CONTAINER} already running`);
    }
    return;
  }
  console.log(`pulling ${IMAGE} (first run only)...`);
  await new Promise<void>((resolve, reject) => {
    docker.pull(IMAGE, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (e: Error | null) => (e ? reject(e) : resolve()));
    });
  });
  const container = await docker.createContainer({
    Image: IMAGE,
    name: CONTAINER,
    Env: ['POSTGRES_DB=jiko', 'POSTGRES_USER=postgres', 'POSTGRES_PASSWORD=postgres'],
    HostConfig: { PortBindings: { '5432/tcp': [{ HostPort: String(port) }] } },
  });
  await container.start();
  console.log(`created and started ${CONTAINER} on port ${port}`);
}

async function waitForPostgres(cfg: ReturnType<typeof localPgConfig>, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const c = new Client({ ...cfg, database: 'postgres' });
    try {
      await c.connect();
      await c.query('SELECT 1');
      await c.end();
      return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('postgres did not become ready');
}

async function main() {
  const base = localPgConfig();
  await startPostgres(base.port);
  await waitForPostgres(base);
  for (const database of ['jiko', 'jiko_test']) {
    const cfg = { ...base, database };
    await ensureDatabase(cfg);
    const client = new Client(cfg);
    await client.connect();
    try {
      console.log(`migrating ${database}`);
      await migrate(client);
    } finally {
      await client.end();
    }
  }
  console.log('local databases ready: jiko (dev), jiko_test (integration tests)');
}

main().catch(err => { console.error(err); process.exit(1); });
