const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const sql = fs.readFileSync('server/sql/schema.sql', 'utf8');
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
