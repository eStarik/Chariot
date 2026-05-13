import postgres from 'postgres';

async function wipeDatabase() {
  const url = process.env.DATABASE_URL || 'postgres://postgres:mysecretpassword@localhost:5432/chariot';
  console.log(`Connecting to database to wipe all tables...`);
  const sql = postgres(url);

  try {
    // Drop all tables in the public schema
    await sql.unsafe(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log('Database wiped and public schema recreated successfully.');
  } catch (err) {
    console.error('Failed to wipe database:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

wipeDatabase();
