const { Pool } = require('pg');

let pool = null;
function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('DATABASE_URL not set');
  const res = await p.query(text, params);
  return res.rows;
}

module.exports = { getPool, query };

