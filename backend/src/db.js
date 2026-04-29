import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'mercadolocal',
  user: process.env.PGUSER || 'mercadolocal',
  password: process.env.PGPASSWORD || 'mercadolocal'
});

export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}
