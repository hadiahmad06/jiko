// src/db/migrate.ts
// Applies db/migrations/*.sql in filename order, once each, tracked in schema_migrations.
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import { localPgConfig } from './config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(here, '..', '..', 'db', 'migrations');

export async function migrate(client: Client, { log = console.log } = {}): Promise<string[]> {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`applied ${file}`);
      ran.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`migration ${file} failed: ${(err as Error).message}`, { cause: err });
    }
  }
  if (ran.length === 0) log('schema up to date');
  return ran;
}

/** Ensures the target database exists (connects to `postgres` to create it). */
export async function ensureDatabase(cfg: ReturnType<typeof localPgConfig>) {
  const admin = new Client({ ...cfg, database: 'postgres' });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [cfg.database]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${cfg.database}"`);
      console.log(`created database ${cfg.database}`);
    }
  } finally {
    await admin.end();
  }
}

