const postgres = require('postgres');
async function main() {
  const sql = postgres('postgres://postgres:mysecretpassword@localhost:5433/chariot');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  console.log('Tables in DB:', tables.map(t => t.table_name));
  await sql.end();
}
main().catch(console.error);
