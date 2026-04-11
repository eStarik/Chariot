const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT count(*) FROM "user"');
  console.log('COUNT:' + res.rows[0].count);
  if (parseInt(res.rows[0].count) > 0) {
    await client.query('DELETE FROM "user"');
    console.log('CLEARED: All users removed');
  }
  await client.end();
}
main().catch(console.error);
