import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function applySchema() {
  const url = process.env.DATABASE_URL || 'postgres://postgres:mysecretpassword@localhost:5432/chariot';
  console.log(`Connecting to database to apply schema...`);
  const sql = postgres(url);

  try {
    const sqlPath = path.join(process.cwd(), 'drizzle', '0000_illegal_molly_hayes.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by --> statement-breakpoint
    const statements = sqlContent.split('--> statement-breakpoint');
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing statement: ${statement.substring(0, 50).trim()}...`);
        await sql.unsafe(statement);
      }
    }

    // Also add the 'storage' column if missing (it might have been added in a later manual change)
    try {
        await sql.unsafe('ALTER TABLE "formations" ADD COLUMN "storage" text NOT NULL DEFAULT \'0Gi\';');
        console.log('Added storage column to formations table.');
    } catch (e) {
        console.log('Storage column already exists or failed to add.');
    }

    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Failed to apply schema:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applySchema();
