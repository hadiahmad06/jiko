import { Client } from 'pg';

const isOffline = process.env.IS_OFFLINE === 'true';

const client = new Client({
  host: isOffline ? 'localhost' : process.env.RDS_HOST,
  port: isOffline ? 5432 : Number(process.env.RDS_PORT),
  database: isOffline ? 'postgres' : process.env.RDS_DB_NAME,
  user: isOffline ? 'postgres' : process.env.RDS_USER,
  password: isOffline ? 'postgres' : process.env.RDS_PASSWORD,
});

client.connect()
  .then(() => {
    console.log(`Postgres client connected successfully (${isOffline ? 'local Docker' : 'AWS RDS'})`);
  })
  .catch((err) => {
    console.error('Error connecting to Postgres client', err);
  });

export default client;
