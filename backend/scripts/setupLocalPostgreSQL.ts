import Docker from 'dockerode';
import { Client } from 'pg';

const DB_NAME = 'jiko';
const DB_USER = 'postgres';
const DB_PASSWORD = 'postgres';
const DB_PORT = 5432;

const docker = new Docker();

async function startPostgresContainer() {
  const containers = await docker.listContainers({ all: true });
  const existingContainer = containers.find(c =>
    c.Names.some(name => name === '/local-postgres')
  );

  if (existingContainer) {
    if (existingContainer.State !== 'running') {
      const container = docker.getContainer(existingContainer.Id);
      await container.start();
      console.log('Started existing Postgres container.');
    } else {
      console.log('Postgres container already running.');
    }
  } else {
    console.log('Creating and starting new Postgres container...');
    await docker.createContainer({
      Image: 'postgres:15',
      name: 'local-postgres',
      Env: [
        `POSTGRES_DB=${DB_NAME}`,
        `POSTGRES_USER=${DB_USER}`,
        `POSTGRES_PASSWORD=${DB_PASSWORD}`,
      ],
      HostConfig: {
        PortBindings: {
          '5432/tcp': [
            {
              HostPort: `${DB_PORT}`,
            },
          ],
        },
      },
    }).then(container => container.start());
    console.log('Postgres container started.');
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTables() {
  const client = new Client({
    host: 'localhost',
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  await client.connect();

  // Example table creation
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      password_hash TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      display_name TEXT,
      nickname TEXT
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      name TEXT,
      description TEXT,
      image TEXT,
      color TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS activity_entries (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      activity_id UUID REFERENCES activities(id),
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      note TEXT,
      logged_by TEXT NOT NULL,
      confidence_score FLOAT,
      duration_minutes INT GENERATED ALWAYS AS (CAST(EXTRACT(EPOCH FROM (end_time - start_time)) / 60 AS INT)) STORED
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS obligations (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP,
      archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS deadlined_obligations (
      id UUID PRIMARY KEY REFERENCES obligations(id),
      deadline TIMESTAMP,
      intervention_level FLOAT DEFAULT 0.5 NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY REFERENCES obligations(id),
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      location TEXT,
      all_day BOOLEAN DEFAULT FALSE
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY REFERENCES obligations(id),
      due_date TIMESTAMP,
      estimated_minutes INT
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS time_allocation_goals (
      id UUID PRIMARY KEY REFERENCES users(id),
      activity_id UUID REFERENCES activities(id),
      strictness FLOAT DEFAULT 0.5 NOT NULL,
      target_minutes INT,
      timeframe_days INT
    );
  `);

  console.log('Postgres tables created successfully!');
  await client.end();
}

async function main() {
  await startPostgresContainer();
  // Wait for Postgres to initialize
  console.log('Waiting for Postgres to initialize...');
  await wait(8000);
  await createTables();
}

main().catch(console.error);