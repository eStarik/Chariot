const postgres = require('postgres');

async function verify() {
  const sql = postgres('postgres://postgres:mysecretpassword@localhost:5434/chariot');
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in public schema:', tables.map(t => t.table_name));
    
    const agentsExists = tables.some(t => t.table_name === 'agents');
    if (agentsExists) {
      console.log('SUCCESS: "agents" table found.');
    } else {
      console.log('FAILURE: "agents" table NOT found.');
    }
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await sql.end();
  }
}

verify();
