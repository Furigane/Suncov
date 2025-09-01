const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenvPath = path.join(__dirname, '..', 'server', '.env');

// Load environment variables from server/.env if present
// so that local developers do not need to manually export them
require('dotenv').config({ path: dotenvPath });

async function main() {
  // Support both DATABASE_URL and Supabase specific variables
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_URL;

  if (!connectionString) {
    console.error('DATABASE_URL or SUPABASE_DB_URL is not set');
    process.exit(1);
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'sql', 'schema.sql'),
    'utf8',
  );
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Schema applied');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
