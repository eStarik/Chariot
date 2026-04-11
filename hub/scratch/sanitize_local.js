const postgres = require('postgres');
async function main() {
  const sql = postgres('postgres://postgres:mysecretpassword@localhost:5433/chariot');
  await sql`DELETE FROM "user"`;
  console.log('CLEARED: All users removed from database.');
  await sql.end();
}
main().catch(console.error);
