// src/db/config.ts
// Local/offline Postgres connection settings. Reads the standard PG* env vars so
// tests and CI can point at a different database without code changes.
export interface PgConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function localPgConfig(): PgConfig {
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'jiko',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  };
}

export function isOffline(): boolean {
  return process.env.IS_OFFLINE === 'true' || process.env.NODE_ENV === 'test';
}
